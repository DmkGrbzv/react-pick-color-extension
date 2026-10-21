import test from 'node:test';
import assert from 'node:assert/strict';
import { SavedPaletteService } from '@/features/saved-palettes/services/savedPaletteService.js';
import { SessionStore } from '@/features/auth/services/sessionStore.js';
import { createPaletteSnapshot, restorePaletteSnapshot, paletteVersion, isSavedPalette } from '@/utils/paletteSnapshot.js';
import { PaletteService } from '@/features/palette/services/paletteService.js';
import { isLibrarySender } from '@/extension/messaging/dispatchLibraryMessage.js';
import { createListener } from '@/extension/messaging/createListener.js';
import { apiManifest } from '../scripts/apiManifest.js';
import { createTestStorage, deferred } from './helpers/extensionStorage.js';

const palette = {
  id: 'current', name: 'Mixed', colors: [
    { id: 'solid', hex: '#AABBCC' },
    { id: 'gradient', type: 'gradient', gradientType: 'linear', direction: 'right',
      stops: [{ hex: '#112233', position: 10 }, { hex: '#FFFFFF', position: 90 }] },
  ],
};
const identity = ( id = 'A' ) => ( {
  token: id.repeat( 43 ), user: { id, email: id + '@example.test' },
  expiresAt: new Date( Date.now() + 86400_000 ).toISOString(),
} );

async function fixture( http = { request: async () => ( {} ) }, login ) {
  const storage = createTestStorage();
  const store = new SessionStore( storage );
  let saved = structuredClone( palette );
  const local = new PaletteService( {
    read: async () => structuredClone( saved ),
    write: async ( value ) => { saved = structuredClone( value ); },
  } );
  const library = new SavedPaletteService( { http, store, palette: local, login: login ?? { signIn: async () => identity() } } );
  return { library, store, storage, local };
}

test( 'mixed snapshot preserves gradient data, excludes IDs and restores independent local cards', () => {
  const snapshot = createPaletteSnapshot( palette );
  assert.equal( snapshot.items[1].type, 'gradient' );
  assert.equal( snapshot.items[0].id, undefined );
  assert.equal( snapshot.items[1].id, undefined );
  let id = 0;
  const restored = restorePaletteSnapshot( snapshot, () => 'new-' + ++id );
  assert.equal( restored.colors[1].id, 'new-2' );
  assert.deepEqual( restored.colors[1].stops, palette.colors[1].stops );
  snapshot.items[1].stops[0].hex = '#000000';
  assert.equal( palette.colors[1].stops[0].hex, '#112233' );
  assert.equal( restored.colors[1].stops[0].hex, '#112233' );
} );

test( 'independent login neither saves nor replaces the working palette and state never exposes a token', async () => {
  const { library, local } = await fixture( { request: async () => assert.fail( 'Unexpected HTTP save' ) } );
  const state = await library.signIn();
  assert.equal( state.user.id, 'A' );
  assert.equal( state.token, undefined );
  assert.equal( state.user.token, undefined );
  assert.deepEqual( await local.getPalette(), palette );
  assert.equal( state.pending, null );
} );

test( 'snapshot prepared before login stays unchanged across later local edits and retries after worker restart', async () => {
  const attempts = [];
  const http = {
    async request( path, options ) {
      attempts.push( structuredClone( options ) );
      if ( attempts.length === 1 ) throw new Error( 'Response lost' );
      return { id: crypto.randomUUID(), ...options.body, createdAt: new Date().toISOString() };
    },
  };
  const { library, store, local } = await fixture( http );
  const prepared = await library.prepare();
  await library.signIn();
  await local.addColor( '#FF0000' );
  await assert.rejects( library.save( prepared.pending.key ) );
  const restarted = new SavedPaletteService( { http, store, palette: local, login: {} } );
  await restarted.save( prepared.pending.key );
  assert.equal( attempts[0].key, attempts[1].key );
  assert.deepEqual( attempts[0].body, attempts[1].body );
  assert.equal( attempts[1].body.items.length, 2 );
  assert.equal( ( await local.getPalette() ).colors.length, 3 );
  assert.equal( ( await restarted.state() ).pending, null );
} );

test( 'double save is blocked while in flight and logout rejects an old response', async () => {
  const response = deferred();
  const entered = deferred();
  const { library, store } = await fixture( {
    async request( path ) {
      if ( path === '/v1/auth/logout' ) return null;
      entered.resolve();
      return response.promise;
    },
  } );
  await library.signIn();
  const { pending } = await library.prepare();
  const saving = library.save( pending.key );
  await entered.promise;
  await assert.rejects( library.save( pending.key ), { code: 'cloudBusy' } );
  await library.logout();
  response.resolve( { id: crypto.randomUUID() } );
  await assert.rejects( saving, { code: 'sessionChanged' } );
  assert.equal( await store.session(), null );
  assert.equal( await store.pending(), null );
} );

test( 'opening checks local version in the queue; a newer local edit wins', async () => {
  const response = deferred();
  const entered = deferred();
  const { library, local } = await fixture( {
    async request() { entered.resolve(); return response.promise; },
  } );
  await library.signIn();
  const opening = library.open( crypto.randomUUID(), paletteVersion( palette ) );
  await entered.promise;
  await local.addColor( '#FF0000' );
  response.resolve( { name: 'Saved set', items: [{ type: 'color', hex: '#000000' }] } );
  await assert.rejects( opening, { code: 'paletteChanged' } );
  assert.equal( ( await local.getPalette() ).colors.length, 3 );
} );

test( 'successful opening replaces once and gives every restored item a new ID', async () => {
  const { library, local } = await fixture( {
    request: async () => createPaletteSnapshot( palette ),
  } );
  await library.signIn();
  const restored = await library.open( crypto.randomUUID(), paletteVersion( palette ) );
  assert.equal( restored.colors.length, 2 );
  assert.notEqual( restored.colors[0].id, palette.colors[0].id );
  assert.deepEqual( await local.getPalette(), restored );
} );

test( 'session survives browser storage restart; pending retry is session-scoped and stale login cannot undo logout', async () => {
  const storage = createTestStorage();
  const store = new SessionStore( storage );
  const epoch = await store.beginLogin();
  await store.saveSession( identity(), epoch );
  await store.setPending( { key: 'pending' } );
  storage.session.data = {};
  // Browser restart clears session storage, while local storage persists.
  await storage.session.remove( 'cloudPendingSave' );
  await storage.session.remove( 'cloudEpoch' );
  const restarted = new SessionStore( storage );
  assert.equal( ( await restarted.session() ).user.id, 'A' );
  assert.equal( await restarted.pending(), null );
  await store.clear();
  await assert.rejects( store.saveSession( identity(), epoch ), { code: 'sessionChanged' } );
} );

test( 'failed server logout still clears local credentials and pending data', async () => {
  const { library, store } = await fixture( { request: async () => { throw new Error( 'Offline' ); } } );
  await library.signIn();
  await library.prepare();
  await assert.rejects( library.logout(), { code: 'logoutUnconfirmed' } );
  assert.equal( await store.session(), null );
  assert.equal( await store.pending(), null );
} );

test( 'a stale unauthorized response cannot clear a newer account session', async () => {
  const storage = createTestStorage();
  const store = new SessionStore( storage );
  const first = identity( 'A' );
  await store.saveSession( first, await store.beginLogin() );
  await store.saveSession( identity( 'B' ), await store.beginLogin() );
  assert.equal( await store.clear( first.token ), false );
  assert.equal( ( await store.session() ).user.id, 'B' );
} );

test( 'switching accounts clears a bound pending save but preserves the local working palette', async () => {
  let user = 'A';
  const { library, store, local } = await fixture( {}, { signIn: async () => identity( user ) } );
  await library.signIn();
  await library.prepare();
  assert.equal( ( await store.pending() ).ownerId, 'A' );
  user = 'B';
  await library.signIn();
  assert.equal( ( await library.state() ).user.id, 'B' );
  assert.equal( await store.pending(), null );
  assert.deepEqual( await local.getPalette(), palette );
  assert.ok( ( await library.prepare() ).pending );
} );

test( 'logout arriving while an opening waits in the local queue prevents replacement', async () => {
  const entered = deferred();
  const release = deferred();
  const { library, local } = await fixture( { request: async ( path ) =>
    path === '/v1/auth/logout' ? null : createPaletteSnapshot( palette ) } );
  await library.signIn();
  // Hold a local write, allowing the library fetch to finish before its queued commit.
  const write = local.replacePalette( palette, paletteVersion( palette ), async ( commit ) => {
    entered.resolve();
    await release.promise;
    await commit();
  } );
  await entered.promise;
  const opening = library.open( crypto.randomUUID(), paletteVersion( palette ) );
  await new Promise( ( resolve ) => setImmediate( resolve ) );
  await library.logout();
  release.resolve();
  await write;
  await assert.rejects( opening, { code: 'sessionChanged' } );
  assert.deepEqual( await local.getPalette(), palette );
} );

test( 'opened source tracks content edits, restored values and account ownership', async () => {
  const id = crypto.randomUUID();
  const { library, local } = await fixture( { request: async () => createPaletteSnapshot( palette ) } );
  await library.signIn();
  await library.open( id, paletteVersion( palette ) );
  const opened = await local.getPalette();
  assert.equal( opened.cloudSource.id, id );
  assert.equal( isSavedPalette( structuredClone( opened ), 'A' ), true );
  assert.equal( isSavedPalette( opened, 'B' ), false );
  await assert.rejects( library.prepare(), { code: 'paletteUnchanged' } );
  await local.addColor( '#FF0000' );
  assert.equal( isSavedPalette( await local.getPalette(), 'A' ), false );
  await local.removeItem( ( await local.getPalette() ).colors.at( -1 ).id );
  assert.equal( isSavedPalette( await local.getPalette(), 'A' ), true );
  const gradient = opened.colors[1];
  await local.saveGradient( { ...gradient, direction: 'left' } );
  assert.equal( isSavedPalette( await local.getPalette(), 'A' ), false );
  await local.saveGradient( gradient );
  assert.equal( isSavedPalette( await local.getPalette(), 'A' ), true );
  const reidentified = { ...opened, colors: opened.colors.map( ( item ) => ( { ...item, id: crypto.randomUUID() } ) ) };
  assert.equal( isSavedPalette( reidentified, 'A' ), true );
  const many = { ...opened, colors: Array.from( { length: 257 }, () => opened.colors[0] ) };
  assert.equal( isSavedPalette( many, 'A' ), false );
} );

test( 'confirmed save locks unchanged work and deleting its source releases it', async () => {
  const id = crypto.randomUUID();
  const { library, local } = await fixture( { request: async ( path, options ) =>
    options.method === 'POST' ? { id, ...options.body } : null } );
  await library.signIn();
  const { pending } = await library.prepare();
  await library.renamePending( pending.key, 'My named palette' );
  const saved = await library.save( pending.key );
  assert.equal( saved.name, 'My named palette' );
  assert.equal( isSavedPalette( await local.getPalette(), 'A' ), true );
  await assert.rejects( library.prepare(), { code: 'paletteUnchanged' } );
  await library.remove( id );
  assert.deepEqual( await local.getPalette(), palette );
  assert.ok( ( await library.prepare() ).pending );
} );

test( 'save responses preserve newer edits and failed attempts retain their original name', async () => {
  const entered = deferred();
  const response = deferred();
  const { library, local } = await fixture( { request: async () => { entered.resolve(); return response.promise; } } );
  await library.signIn();
  const { pending } = await library.prepare();
  await assert.rejects( library.renamePending( pending.key, 'x'.repeat( 121 ) ), { code: 'invalidPalette' } );
  const saving = library.save( pending.key );
  await entered.promise;
  await local.addColor( '#FF0000' );
  response.resolve( { id: crypto.randomUUID() } );
  await saving;
  assert.equal( isSavedPalette( await local.getPalette(), 'A' ), false );
  const retry = await fixture( { request: async () => { throw new Error( 'Response lost' ); } } );
  await retry.library.signIn();
  const prepared = await retry.library.prepare();
  await retry.library.save( prepared.pending.key ).catch( () => {} );
  await assert.rejects( retry.library.renamePending( prepared.pending.key, 'Changed' ), { code: 'saveConflict' } );
  assert.equal( isSavedPalette( await retry.local.getPalette(), 'A' ), false );
} );

test( 'library messages reject content scripts and external senders, and hide raw errors', async () => {
  const extensionId = 'a'.repeat( 32 );
  const sender = { id: extensionId, url: 'chrome-extension://' + extensionId + '/editor.html' };
  assert.equal( isLibrarySender( sender, extensionId ), true );
  assert.equal( isLibrarySender( { ...sender, url: 'chrome-extension://' + extensionId + '/library.html' }, extensionId ), true );
  assert.equal( isLibrarySender( { ...sender, url: 'chrome-extension://' + extensionId + '/print.html' }, extensionId ), true );
  assert.equal( isLibrarySender( { ...sender, url: 'chrome-extension://' + extensionId + '/unknown.html' }, extensionId ), false );
  assert.equal( isLibrarySender( { ...sender, url: 'chrome-extension://' + extensionId + '/print.html/other' }, extensionId ), false );
  assert.equal( isLibrarySender( { ...sender, url: 'https://website.test' }, extensionId ), false );
  assert.equal( isLibrarySender( { ...sender, id: 'other' }, extensionId ), false );
  const listener = createListener( extensionId, () => { throw new Error( 'private-token' ); } );
  assert.equal( listener( { type: 'cloud:state' }, { id: extensionId }, () => {} ), false );
  const response = await new Promise( ( resolve ) => listener( { type: 'cloud:state' }, sender, resolve ) );
  assert.equal( response.details, undefined );
  assert.ok( !JSON.stringify( response ).includes( 'private-token' ) );
} );

test( 'build permissions include only configured host and identity; unconfigured builds stay local', () => {
  const manifest = { permissions: ['storage'], version: '1.0.0' };
  assert.deepEqual( apiManifest( manifest, '' ), manifest );
  const enabled = apiManifest( manifest, 'https://api.example.test' );
  assert.deepEqual( enabled.host_permissions, ['https://api.example.test/*'] );
  assert.deepEqual( enabled.permissions, ['storage', 'identity'] );
  assert.throws( () => apiManifest( manifest, 'http://public.example.test' ) );
  assert.throws( () => apiManifest( manifest, 'https://api.example.test/path' ) );
} );
