import test from 'node:test';
import assert from 'node:assert/strict';
import { ChromeSessionStorage } from '@/features/auth/adapters/chromeSessionStorage.js';
import { subscribeToAccountEvents } from '@/features/auth/adapters/accountEvents.js';
import { SessionStore } from '@/features/auth/services/sessionStore.js';
import { createTestStorage, deferred } from './helpers/extensionStorage.js';

test( 'Chrome adapter restricts both lifetimes once and reads existing records without migration', async () => {
  const storage = createTestStorage();
  const calls = [];
  for ( const area of ['local', 'session'] ) storage[area].setAccessLevel = async ( options ) => calls.push( [area, options] );
  const identity = { token: 'A'.repeat( 43 ), user: { id: 'A' }, expiresAt: new Date( Date.now() + 60_000 ).toISOString() };
  await storage.local.set( { cloudSession: identity } );
  await storage.session.set( { cloudPendingSave: { key: 'existing' }, cloudEpoch: 'epoch' } );
  const adapter = new ChromeSessionStorage( storage );
  const store = new SessionStore( adapter );
  assert.deepEqual( await store.session(), identity );
  assert.equal( ( await store.pending() ).key, 'existing' );
  await store.initialize();
  assert.deepEqual( calls, [['local', { accessLevel: 'TRUSTED_CONTEXTS' }], ['session', { accessLevel: 'TRUSTED_CONTEXTS' }]] );
  await adapter.removePersistent( 'cloudSession' );
  assert.equal( await store.session(), null );
} );

test( 'session policy uses a browser-independent storage contract and keeps mutations ordered', async () => {
  const persistent = {};
  const temporary = {};
  const entered = deferred();
  const release = deferred();
  const storage = {
    initialize: async () => {},
    readPersistent: async ( key ) => ( { [key]: structuredClone( persistent[key] ) } ),
    writePersistent: async ( values ) => Object.assign( persistent, structuredClone( values ) ),
    readTemporary: async ( key ) => ( { [key]: structuredClone( temporary[key] ) } ),
    writeTemporary: async ( values ) => Object.assign( temporary, structuredClone( values ) ),
    removeTemporary: async ( key ) => { delete temporary[key]; },
  };
  const store = new SessionStore( storage );
  const identity = { token: 'A'.repeat( 43 ), user: { id: 'A' }, expiresAt: new Date( Date.now() + 60_000 ).toISOString() };
  await store.saveSession( identity, await store.beginLogin() );
  const commit = store.withSession( identity, async () => { entered.resolve(); await release.promise; } );
  await entered.promise;
  let cleared = false;
  const logout = store.clear().then( () => { cleared = true; } );
  await Promise.resolve();
  assert.equal( cleared, false );
  release.resolve();
  await Promise.all( [commit, logout] );
  assert.equal( await store.session(), null );
  await assert.rejects( store.withSession( identity, () => assert.fail( 'Stale session' ) ), { code: 'sessionChanged' } );
} );

test( 'account events filter unrelated changes and remove the exact subscription', async () => {
  const storage = createTestStorage();
  let session = 0;
  let pending = 0;
  const unsubscribe = subscribeToAccountEvents( {
    onSessionChange: () => session++, onPendingChange: () => pending++,
  }, storage );
  await storage.local.set( { theme: 'dark', cloudPendingSave: {} } );
  await storage.session.set( { cloudSession: {}, cloudEpoch: 'new' } );
  assert.deepEqual( [session, pending], [0, 0] );
  await storage.local.set( { cloudSession: null } );
  await storage.session.set( { cloudPendingSave: {} } );
  assert.deepEqual( [session, pending], [1, 1] );
  unsubscribe();
  await storage.local.set( { cloudSession: {} } );
  assert.deepEqual( [session, pending], [1, 1] );
  assert.equal( storage.listeners.size, 0 );
} );

test( 'storage failures propagate and a failed mutation does not poison the policy queue', async () => {
  const storage = createTestStorage();
  const store = new SessionStore( new ChromeSessionStorage( storage ) );
  const write = storage.session.set;
  storage.session.set = async () => { throw new Error( 'Persistence unavailable' ); };
  await assert.rejects( store.beginLogin(), /Persistence unavailable/ );
  storage.session.set = write;
  assert.equal( typeof await store.beginLogin(), 'string' );
  storage.local.get = async () => { throw new Error( 'Read unavailable' ); };
  await assert.rejects( store.session(), /Read unavailable/ );
} );
