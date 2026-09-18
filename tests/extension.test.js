import { GET_PALETTE, ADD_COLOR, REMOVE_COLOR, findCorrectMessageType } from '@/messageTypes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaletteExecutor } from './helpers/palette.js';
import { subscribeToPalette } from '@/api/paletteClient.js';
import { PALETTE_KEY } from '@/types.js';

function createStorage() {
  let data = {};
  let fail = false;
  return {
    async get() {
      await Promise.resolve();
      return structuredClone( data );
    },
    async set( value ) {
      await Promise.resolve();
      if ( fail ) {
        fail = false;
        throw new Error( 'Disk error' );
      }
      data = structuredClone( { ...data, ...value } );
    },
    failNextWrite() {
      fail = true;
    },
  };
}

function setup() {
  const storage = createStorage();
  let id = 0;
  const execute = createPaletteExecutor( storage, () => String( ++id ) );
  return { storage, execute };
}

test( 'concurrent additions from two views survive and persist across worker restart', async () => {
  const { storage, execute } = setup();
  await Promise.all( [
    execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#ff0000' } ),
    execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#00ff00' } ),
  ] );
  const restarted = createPaletteExecutor( storage );
  const palette = await restarted( { type: findCorrectMessageType( GET_PALETTE ) } );
  assert.deepEqual( palette.colors, [
    { id: '1', hex: '#FF0000' },
    { id: '2', hex: '#00FF00' },
  ] );
  assert.equal( palette.id, 'current' );
} );

test( 'duplicate colors are normalized and are not appended', async () => {
  const { execute } = setup();
  await execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#aabbcc' } );
  const palette = await execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#AABBCC' } );
  assert.equal( palette.colors.length, 1 );
} );

test( 'concurrent deletion and addition do not restore the removed color', async () => {
  const { execute } = setup();
  await execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#112233' } );
  await Promise.all( [
    execute( { type: findCorrectMessageType( REMOVE_COLOR ), id: '1' } ),
    execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#445566' } ),
  ] );
  const palette = await execute( { type: findCorrectMessageType( GET_PALETTE ) } );
  assert.deepEqual( palette.colors, [{ id: '2', hex: '#445566' }] );
  await execute( { type: findCorrectMessageType( REMOVE_COLOR ), id: '2' } );
  assert.deepEqual( ( await execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors, [] );
} );

test( 'failed storage writes are reported without corrupting data or blocking the queue', async () => {
  const { storage, execute } = setup();
  storage.failNextWrite();
  await assert.rejects(
    execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#112233' } ),
    /Disk error/
  );
  assert.deepEqual( ( await execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors, [] );
  await execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#445566' } );
  assert.equal( ( await execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors.length, 1 );
} );

test( 'invalid input and corrupt stored data are rejected without overwriting storage', async () => {
  const { storage, execute } = setup();
  await assert.rejects( execute( { type: findCorrectMessageType( ADD_COLOR ), hex: 'red' } ), {
    code: 'invalidHex',
  } );
  const corrupt = { id: 'current', colors: 'broken' };
  await storage.set( { [PALETTE_KEY]: corrupt } );
  await assert.rejects( execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#123456' } ), {
    code: 'invalidPalette',
  } );
  assert.deepEqual( ( await storage.get() )[PALETTE_KEY], corrupt );
} );

test( 'storage notifications update both views, ignore other areas, and unsubscribe', () => {
  const listeners = new Set();
  const previous = globalThis.chrome;
  globalThis.chrome = {
    runtime: { id: 'test' },
    storage: {
      onChanged: {
        addListener: ( listener ) => listeners.add( listener ),
        removeListener: ( listener ) => listeners.delete( listener ),
      },
    },
  };
  try {
    const panel = [];
    const editor = [];
    const errors = [];
    const stopPanel = subscribeToPalette(
      ( p ) => panel.push( p ),
      ( e ) => errors.push( e )
    );
    const stopEditor = subscribeToPalette(
      ( p ) => editor.push( p ),
      ( e ) => errors.push( e )
    );
    const palette = { id: 'current', name: 'My palette', colors: [{ id: '1', hex: '#123456' }] };
    const changes = { [PALETTE_KEY]: { newValue: palette } };
    listeners.forEach( ( listener ) => listener( changes, 'sync' ) );
    assert.equal( panel.length, 0 );
    listeners.forEach( ( listener ) => listener( changes, 'local' ) );
    assert.deepEqual( panel, [palette] );
    assert.deepEqual( editor, [palette] );
    listeners.forEach( ( listener ) => listener( { [PALETTE_KEY]: {} }, 'local' ) );
    assert.deepEqual( panel.at( -1 ).colors, [] );
    listeners.forEach( ( listener ) => listener( { [PALETTE_KEY]: { newValue: false } }, 'local' ) );
    assert.equal( errors.length, 2 );
    stopPanel();
    stopEditor();
    assert.equal( listeners.size, 0 );
  } finally {
    if ( previous === undefined ) delete globalThis.chrome;
    else globalThis.chrome = previous;
  }
} );
