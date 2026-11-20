import test from 'node:test';
import assert from 'node:assert/strict';
import { PaletteService } from '@/features/palette/services/paletteService.js';
import { createPaletteExecutor } from './helpers/palette.js';
import { createListener } from '@/extension/messaging/createListener.js';
import { deferred } from './helpers/extensionStorage.js';

function fixture() {
  let palette = { id: 'current', name: 'Keep', colors: [{ id: 'old', hex: '#aabbcc' }, { id: 'gradient', type: 'gradient', gradientType: 'linear', direction: 'right', stops: [{ hex: '#000000', position: 0 }, { hex: '#FFFFFF', position: 100 }] }], cloudSource: { id: 'saved', ownerId: 'one', signature: 'old' } };
  let writes = 0;
  let failure = false;
  const service = new PaletteService( {
    read: async () => structuredClone( palette ),
    write: async value => { if ( failure ) throw new Error( 'storage failure' ); writes++; palette = structuredClone( value ); },
  } );
  return { service, read: () => structuredClone( palette ), writes: () => writes, fail: value => { failure = value; } };
}

test( 'batch adds once at the beginning, deduplicates and preserves existing fields and gradients', async () => {
  const { service, read, writes } = fixture();
  const before = read();
  const result = await service.addColors( ['#aabbcc', '#123456', '#123456', '#abcdef'] );
  assert.equal( writes(), 1 );
  assert.deepEqual( result.colors.slice( 0, 2 ).map( item => item.hex ), ['#123456', '#ABCDEF'] );
  assert.deepEqual( result.colors.slice( 2 ), before.colors );
  assert.deepEqual( { ...result, colors: before.colors }, before );
  await service.addColors( ['#ABCDEF', '#aabbcc'] );
  assert.equal( writes(), 1 );
  assert.equal( new Set( result.colors.map( item => item.id ) ).size, result.colors.length );
} );

test( 'invalid batches and failed storage preserve the complete working palette and queue recovers', async () => {
  const { service, read, writes, fail } = fixture();
  const before = read();
  for ( const values of [null, 'bad', [], Array( 6 ).fill( '#123456' ), ['#123456', 'invalid'], [null], [123], Array( 2 )] ) {
    await assert.rejects( service.addColors( values ), { code: 'invalidHex' } );
    assert.deepEqual( read(), before );
  }
  fail( true );
  await assert.rejects( service.addColors( ['#123456', '#ABCDEF'] ), /storage failure/ );
  assert.deepEqual( read(), before );
  assert.equal( writes(), 0 );
  fail( false );
  await service.addColors( ['#123456'] );
  await service.addColors( ['#000001', '#000002', '#000003', '#000004', '#000005'] );
  assert.equal( writes(), 2 );
} );

test( 'batch and single commands share one queue and publish one complete state per write', async () => {
  let palette = { id: 'current', name: '', colors: [] };
  const entered = deferred();
  const release = deferred();
  const states = [];
  const service = new PaletteService( {
    read: async () => structuredClone( palette ),
    write: async value => {
      if ( !states.length ) { entered.resolve(); await release.promise; }
      palette = structuredClone( value ); states.push( palette );
    },
  } );
  const batch = service.addColors( ['#123456', '#ABCDEF'] );
  await entered.promise;
  const single = service.addColor( '#000000' );
  const duplicateBatch = service.addColors( ['#abcdef', '#FFFFFF'] );
  assert.equal( states.length, 0 );
  release.resolve();
  await Promise.all( [batch, single, duplicateBatch] );
  assert.deepEqual( states.map( state => state.colors.map( color => color.hex ) ), [
    ['#123456', '#ABCDEF'], ['#000000', '#123456', '#ABCDEF'], ['#FFFFFF', '#000000', '#123456', '#ABCDEF'],
  ] );
} );

test( 'batch transport uses the real worker dispatcher and rejects untrusted senders', async () => {
  let stored = { id: 'current', name: '', colors: [] };
  let writes = 0;
  const execute = createPaletteExecutor( { get: async () => ( { currentPalette: stored } ), set: async values => { writes++; stored = values.currentPalette; } } );
  const message = { type: 'palette:addColors', hexes: ['#123456', '#ABCDEF'] };
  const listener = createListener( 'ext', execute );
  assert.equal( listener( message, { id: 'other', url: 'chrome-extension://ext/editor.html' }, () => {} ), false );
  assert.equal( listener( message, { id: 'ext', url: 'https://site.test/' }, () => {} ), false );
  await new Promise( resolve => {
    assert.equal( listener( message, { id: 'ext', url: 'chrome-extension://ext/editor.html' }, response => { assert.equal( response.ok, true ); resolve(); } ), true );
  } );
  assert.equal( writes, 1 );
  assert.equal( listener( message, { id: 'ext' }, () => assert.fail( 'No URL' ) ), false );
  await new Promise( resolve => listener( message, { id: 'ext', url: 'chrome-extension://ext/sidepanel.html' }, response => { assert.equal( response.ok, true ); resolve(); } ) );
  assert.equal( writes, 1, 'side panel retry is deduplicated' );
  assert.equal( stored.colors.length, 2 );
} );
