import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaletteExecutor } from './helpers/palette.js';
import { createTestStorage } from './helpers/extensionStorage.js';
import { paletteVersion } from '@/utils/paletteSnapshot.js';

const mixed = {
  id: 'current', name: 'Saved set',
  colors: [{ id: 'color', hex: '#123456' }, {
    id: 'gradient', type: 'gradient', gradientType: 'linear', direction: 'right',
    stops: [{ hex: '#000000', position: 0 }, { hex: '#FFFFFF', position: 100 }],
  }],
};

test( 'clearing guest or library-backed work removes all items and its name without touching account data', async () => {
  for ( const cloudSource of [undefined, { id: 'saved-set', ownerId: 'user', signature: 'saved' }] ) {
    const storage = createTestStorage();
    const initial = { ...mixed, ...( cloudSource ? { cloudSource } : {} ) };
    Object.assign( storage.local.data, { currentPalette: initial, language: 'en', colorFormat: 'rgb',
      cloudSession: { token: 'fixture-session' } } );
    storage.session.data.cloudPendingSave = { snapshot: structuredClone( mixed ) };
    const before = structuredClone( storage.local.data );
    const pending = structuredClone( storage.session.data );
    const execute = createPaletteExecutor( storage.local );
    await execute( { type: 'palette:clear', expectedVersion: paletteVersion( initial ) } );
    const restarted = createPaletteExecutor( storage.local );
    const empty = await restarted( { type: 'palette:get' } );
    assert.deepEqual( empty, { id: 'current', name: '', colors: [] } );
    assert.deepEqual( storage.local.data, { ...before, currentPalette: empty } );
    assert.deepEqual( storage.session.data, pending );
  }
} );

test( 'a stale clear cannot delete newer edits; an addition queued after a clear is retained', async () => {
  const storage = createTestStorage();
  storage.local.data.currentPalette = structuredClone( mixed );
  const execute = createPaletteExecutor( storage.local, () => 'new' );
  const oldVersion = paletteVersion( mixed );
  await execute( { type: 'palette:add', hex: '#ABCDEF' } );
  await assert.rejects( execute( { type: 'palette:clear', expectedVersion: oldVersion } ), { code: 'paletteChanged' } );
  const current = await execute( { type: 'palette:get' } );
  assert.equal( current.colors.length, 3 );
  await Promise.all( [
    execute( { type: 'palette:clear', expectedVersion: paletteVersion( current ) } ),
    execute( { type: 'palette:add', hex: '#FEDCBA' } ),
  ] );
  assert.deepEqual( ( await execute( { type: 'palette:get' } ) ).colors, [{ id: 'new', hex: '#FEDCBA' }] );
} );

test( 'a failed clear preserves local work and its queue accepts a subsequent retry', async () => {
  const storage = createTestStorage();
  storage.local.data.currentPalette = structuredClone( mixed );
  const write = storage.local.set;
  storage.local.set = async () => { throw new Error( 'Disk unavailable' ); };
  const execute = createPaletteExecutor( storage.local );
  const message = { type: 'palette:clear', expectedVersion: paletteVersion( mixed ) };
  await assert.rejects( execute( message ), /Disk unavailable/ );
  assert.deepEqual( await execute( { type: 'palette:get' } ), mixed );
  storage.local.set = write;
  assert.deepEqual( await execute( message ), { id: 'current', name: '', colors: [] } );
} );
