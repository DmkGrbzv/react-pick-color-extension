import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, rgbToCmyk, colorValues } from '@/utils/colorConversion.js';
import { DEFAULT_PRINT_SETTINGS, paginateItems, printLayout } from '@/utils/printLayout.js';
import { createColorFormatClient } from '@/api/colorFormatClient.js';
import { createPanelController } from '@/panelController.js';

test( 'color conversion handles black, white, primaries, shorthand and supplied sample', () => {
  assert.deepEqual( hexToRgb( '#cfa5b4' ), { red: 207, green: 165, blue: 180 } );
  assert.deepEqual( hexToRgb( '#0f8' ), { red: 0, green: 255, blue: 136 } );
  assert.equal( colorValues( '#CFA5B4' ).rgb, '207, 165, 180' );
  assert.equal( colorValues( '#CFA5B4' ).cmyk, '0%, 20%, 13%, 19%' );
  assert.equal( colorValues( '#000000' ).cmyk, '0%, 0%, 0%, 100%' );
  assert.equal( colorValues( '#FFFFFF' ).cmyk, '0%, 0%, 0%, 0%' );
  assert.equal( colorValues( '#FF0000' ).cmyk, '0%, 100%, 100%, 0%' );
  assert.equal( colorValues( '#00FF00' ).cmyk, '100%, 0%, 100%, 0%' );
  assert.equal( colorValues( '#0000FF' ).cmyk, '100%, 100%, 0%, 0%' );
} );
test( 'conversion rejects invalid inputs instead of producing misleading values', () => {
  for ( const hex of ['red', '#12345', '#12345678', null] ) assert.throws( () => hexToRgb( hex ) );
  for ( const value of [-1, 256, NaN, '20', 1.5] ) assert.throws( () => rgbToCmyk( value, 0, 0 ) );
} );
test( 'all print layouts preserve mixed items and paginate at exact boundaries without blank trailing pages', () => {
  for ( const orientation of ['portrait', 'landscape'] ) for ( const size of ['medium', 'large'] ) {
    const settings = { ...DEFAULT_PRINT_SETTINGS, orientation, size };
    const layout = printLayout( settings );
    const items = Array.from( { length: layout.capacity * 2 + 1 }, ( _, id ) => ( { id, type: id % 2 ? 'gradient' : 'color' } ) );
    const before = JSON.stringify( items );
    const pages = paginateItems( items, settings );
    assert.equal( pages.length, 3 );
    assert.deepEqual( pages.flat(), items );
    assert.equal( pages[2].length, 1 );
    assert.equal( paginateItems( items.slice( 0, -1 ), settings ).length, 2 );
    assert.deepEqual( paginateItems( [], settings ), [[]] );
    assert.equal( JSON.stringify( items ), before );
    assert.equal( layout.width, orientation === 'portrait' ? 210 : 297 );
  }
} );
test( 'format preference persists and syncs without modifying palette storage', async () => {
  const palette = { id: 'current', colors: [{ id: 'c', hex: '#123456' }] };
  const data = { currentPalette: palette };
  const listeners = new Set();
  const api = {
    local: { async get( key ) { return { [key]: data[key] }; }, async set( values ) { Object.assign( data, values ); for ( const listener of listeners ) listener( { colorFormat: { newValue: values.colorFormat } }, 'local' ); } },
    onChanged: { addListener( listener ) { listeners.add( listener ); }, removeListener( listener ) { listeners.delete( listener ); } },
  };
  const client = createColorFormatClient( api );
  assert.equal( await client.read(), 'hex' );
  const updates = [];
  const stop = createColorFormatClient( api ).subscribe( value => updates.push( value ) );
  await client.save( 'cmyk' );
  assert.equal( await createColorFormatClient( api ).read(), 'cmyk' );
  assert.deepEqual( updates, ['cmyk'] );
  assert.equal( data.currentPalette, palette );
  assert.deepEqual( Object.keys( data ).sort(), ['colorFormat', 'currentPalette'] );
  await assert.rejects( client.save( 'lab' ) );
  assert.equal( data.colorFormat, 'cmyk' );
  stop(); assert.equal( listeners.size, 0 );
} );
test( 'format storage failures propagate to the caller', async () => {
  const failure = new Error( 'Storage unavailable' );
  const client = createColorFormatClient( { local: { async get() { throw failure; }, async set() { throw failure; } } } );
  await assert.rejects( client.read(), error => error === failure );
  await assert.rejects( client.save( 'rgb' ), error => error === failure );
} );
test( 'print preview disables its own side panel without changing another tab', async () => {
  const changes = [];
  const api = {
    runtime: { getURL: path => 'chrome-extension://test/' + path },
    tabs: { async get( id ) { return { id, url: 'chrome-extension://test/print.html' }; } },
    sidePanel: { async getOptions() { return { enabled: true }; }, async setOptions( value ) { changes.push( value ); } },
    action: { async disable( id ) { assert.equal( id, 8 ); }, async enable() { assert.fail( 'Unexpected action enable' ); } },
  };
  await createPanelController( api ).sync( 8 );
  assert.deepEqual( changes, [{ tabId: 8, enabled: false }] );
} );
