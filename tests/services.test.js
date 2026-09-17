import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageAdapter } from '@/storage.js';
import { createPaletteRepository } from '@/services/paletteRepository.js';
import { createPaletteService } from '@/services/paletteService.js';
import { createListener } from '@/runtime/createListener.js';
import { createRouter } from '@/runtime/createRouter.js';
import { sendRequest } from '@/runtime/sendRequest.js';
import { subscribeToPalette } from '@/api/paletteClient.js';
import { AppError } from '@/errors.js';
import { GET_PALETTE, OPEN_EDITOR, findCorrectMessageType } from '@/messageTypes.js';

test( 'storage and service propagate the original read/write failure and the queue recovers', async () => {
  const failure = new Error( 'Disk unavailable' );
  let readFails = true;
  let writeFails = false;
  let saved;
  const storage = createStorageAdapter( { local: {
    async get() { if ( readFails ) throw failure; return { currentPalette: saved }; },
    async set( value ) { if ( writeFails ) throw failure; saved = structuredClone( value.currentPalette ); },
  } } );
  const service = createPaletteService( createPaletteRepository( storage ), () => 'color-id' );
  await assert.rejects( service.getPalette(), ( error ) => error === failure );
  readFails = false;
  writeFails = true;
  await assert.rejects( service.addColor( '#123456' ), ( error ) => error === failure );
  assert.equal( saved, undefined );
  writeFails = false;
  await service.addColor( '#123456' );
  assert.deepEqual( ( await service.getPalette() ).colors, [{ id: 'color-id', hex: '#123456' }] );
} );

test( 'repository validation errors propagate without overwriting corrupt data', async () => {
  const value = { colors: 'broken' };
  const service = createPaletteService( createPaletteRepository( {
    get: async () => value,
    set: () => assert.fail( 'Must not overwrite corrupt data' ),
  } ) );
  await assert.rejects( service.getPalette(), { code: 'invalidPalette' } );
} );

test( 'message listener rejects wrong senders and unknown/null messages independently', () => {
  const listener = createListener( 'own-id', () => assert.fail( 'Unexpected dispatch' ) );
  const respond = () => assert.fail( 'Unexpected response' );
  assert.equal( listener( { type: findCorrectMessageType( GET_PALETTE ) }, { id: 'other-id' }, respond ), false );
  assert.equal( listener( { type: 'unknown' }, { id: 'own-id' }, respond ), false );
  assert.equal( listener( null, { id: 'own-id' }, respond ), false );
} );

test( 'worker serializes async service errors and synchronous errors at one boundary', async () => {
  for ( const [failure, expected] of [
    [new AppError( 'invalidHex' ), 'invalidHex'],
    [new Error( 'Disk unavailable' ), 'storageFailure'],
  ] ) {
    const listener = createListener( 'own-id', () => { throw failure; } );
    const response = await new Promise( ( resolve ) => {
      assert.equal( listener( { type: findCorrectMessageType( GET_PALETTE ) }, { id: 'own-id' }, resolve ), true );
    } );
    assert.deepEqual( response, { ok: false, error: expected, details: failure.message } );
  }
  const listener = createListener( 'own-id', async () => { throw new Error( 'Window missing' ); } );
  const response = await new Promise( ( resolve ) => listener(
    { type: findCorrectMessageType( OPEN_EDITOR ) }, { id: 'own-id' }, resolve
  ) );
  assert.equal( response.error, 'editorFailed' );
} );

test( 'router preserves sender window priority and rejects unsupported commands', async () => {
  let args;
  const dispatch = createRouter( {
    paletteService: {},
    openEditor: async ( ...values ) => { args = values; return 42; },
  } );
  assert.equal( await dispatch(
    { type: findCorrectMessageType( OPEN_EDITOR ), windowId: 2, gradientId: 'g' },
    { tab: { windowId: 1 } }
  ), 42 );
  assert.deepEqual( args, [1, 'g'] );
  await assert.rejects( dispatch( null ), { code: 'unknownOperation' } );
} );

test( 'client rejects failures up to the UI and preserves their cause', async () => {
  const previous = globalThis.chrome;
  const failure = new Error( 'Worker stopped' );
  try {
    globalThis.chrome = { runtime: { id: 'test', sendMessage: async () => { throw failure; } } };
    await assert.rejects( sendRequest( {} ), ( error ) =>
      error.code === 'extensionUnavailable' && error.cause === failure
    );
    chrome.runtime.sendMessage = async () => ( { ok: false, error: 'storageFailure', details: 'Disk unavailable' } );
    await assert.rejects( sendRequest( {} ), ( error ) =>
      error.code === 'storageFailure' && error.cause.message === 'Disk unavailable'
    );
    chrome.runtime.sendMessage = async () => ( { ok: true, value: 42 } );
    assert.equal( await sendRequest( {} ), 42 );
  } finally {
    if ( previous === undefined ) delete globalThis.chrome;
    else globalThis.chrome = previous;
  }
} );

test( 'subscription setup errors are delivered to the UI instead of disappearing', () => {
  const previous = globalThis.chrome;
  const failure = new Error( 'Event connection failed' );
  try {
    globalThis.chrome = { runtime: { id: 'test' }, storage: {
      onChanged: { addListener() { throw failure; } },
    } };
    const errors = [];
    const stop = subscribeToPalette( () => assert.fail( 'Unexpected value' ), ( error ) => errors.push( error ) );
    assert.deepEqual( errors, [failure] );
    stop();
  } finally {
    if ( previous === undefined ) delete globalThis.chrome;
    else globalThis.chrome = previous;
  }
} );
