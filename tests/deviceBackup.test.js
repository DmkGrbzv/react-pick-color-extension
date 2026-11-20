import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceBackupService } from '@/features/saved-palettes/services/deviceBackupService.js';
import { BACKUP_KEY, validateDeviceBackup } from '@/features/saved-palettes/utils/deviceBackupValidation.js';
import { ChromeSessionStorage } from '@/features/auth/adapters/chromeSessionStorage.js';
import { SessionStore } from '@/features/auth/services/sessionStore.js';
import { PaletteService } from '@/features/palette/services/paletteService.js';
import { paletteVersion } from '@/utils/paletteSnapshot.js';
import { createListener } from '@/extension/messaging/createListener.js';
import { ApiClient } from '@/api/client.js';
import { createTestStorage, deferred } from './helpers/extensionStorage.js';

const gradient = { type: 'gradient', gradientType: 'linear', direction: 'left', stops: [{ hex: '#123456', position: 5 }, { hex: '#ABCDEF', position: 90 }] };
const record = ( n ) => ( { id: '00000000-0000-4000-8000-' + String( n ).padStart( 12, '0' ), name: 'Set ' + n,
  items: [{ type: 'color', hex: '#AABBCC' }, structuredClone( gradient )], createdAt: new Date().toISOString() } );
const page = ( palettes = [record( 1 )], nextCursor = null ) => ( { palettes, nextCursor } );
async function fixture( request = async () => page() ) {
  const api = createTestStorage();
  const storage = new ChromeSessionStorage( api );
  const store = new SessionStore( storage );
  const epoch = await store.beginLogin();
  await store.saveSession( { token: 'a'.repeat( 43 ), user: { id: 'one', email: 'secret@example.test' }, expiresAt: new Date( Date.now() + 60000 ).toISOString() }, epoch );
  let working = { id: 'current', name: '', colors: [] };
  const palette = new PaletteService( { read: async () => structuredClone( working ), write: async ( value ) => { working = structuredClone( value ); } } );
  const backup = new DeviceBackupService( { storage, store, http: { request }, palette } );
  return { backup, api, store, palette, storage };
}

test( 'backup captures full pages and gradients, strips record identities, and works offline after logout', async () => {
  let calls = 0;
  const { backup, store, api, palette } = await fixture( async ( url ) => {
    calls++;
    if ( calls === 1 ) return page( [record( 1 ), record( 2 )], 'next' );
    assert.match( url, /cursor=next/ );
    return page( [record( 3 )] );
  } );
  await backup.create();
  assert.equal( calls, 2 );
  const copy = await backup.read();
  assert.equal( copy.count, 3 );
  assert.deepEqual( copy.palettes[2].items[1], gradient );
  assert.deepEqual( Object.keys( copy.palettes[0] ), ['name', 'items'] );
  assert.ok( !JSON.stringify( api.local.data[BACKUP_KEY] ).includes( 'secret@example.test' ) );
  await store.clear();
  assert.equal( ( await backup.read() ).count, 3 );
  const before = await palette.getPalette();
  await backup.open( copy.createdAt, 2, paletteVersion( before ) );
  assert.equal( ( await palette.getPalette() ).name, 'Set 3' );
  assert.equal( ( await palette.getPalette() ).cloudSource, undefined );
  await assert.rejects( backup.open( copy.createdAt, 0, paletteVersion( before ) ), /paletteChanged/ );
  await backup.remove();
  assert.equal( await backup.read(), null );
} );

test( 'failed second page and storage-full refresh preserve the previous copy', async () => {
  const { backup, api, store } = await fixture();
  await backup.create();
  const original = structuredClone( api.local.data[BACKUP_KEY] );
  let calls = 0;
  const other = new DeviceBackupService( { storage: new ChromeSessionStorage( api ), store,
    http: { request: async () => { if ( calls++ ) throw new Error( 'offline' ); return page( [record( 2 )], 'next' ); } } } );
  await assert.rejects( other.create() );
  assert.deepEqual( api.local.data[BACKUP_KEY], original );
  const set = api.local.set;
  api.local.set = async () => { throw new Error( 'QUOTA_BYTES' ); };
  await assert.rejects( backup.create(), /backupStorageFailed/ );
  assert.deepEqual( api.local.data[BACKUP_KEY], original );
  api.local.set = set;
} );

test( 'duplicate capture is refused; account generation change and deletion cancel an in-flight capture', async () => {
  for ( const cancel of ['account', 'delete'] ) {
    const response = deferred();
    const entered = deferred();
    const { backup, store, api } = await fixture( async () => { entered.resolve(); return response.promise; } );
    const capture = backup.create();
    const rejected = assert.rejects( capture, /sessionChanged/ );
    await entered.promise;
    await assert.rejects( backup.create(), /cloudBusy/ );
    if ( cancel === 'account' ) await store.beginLogin();
    else await backup.remove();
    response.resolve( page() );
    await rejected;
    assert.equal( api.local.data[BACKUP_KEY], undefined );
  }
} );

test( 'untrusted backup rejects script CSS, extra fields, invalid gradients, oversized content and bad versions; deletion still works', async () => {
  const { backup, api } = await fixture();
  await backup.create();
  const original = structuredClone( api.local.data[BACKUP_KEY] );
  const mutations = [
    ( v ) => { v.version = 2; }, ( v ) => { v.token = 'secret'; },
    ( v ) => { v.palettes[0].items[0].hex = 'url(javascript:alert(1))'; },
    ( v ) => { v.palettes[0].items[1].direction = 'url(https://bad.test)'; },
    ( v ) => { v.palettes[0].items[1].stops[0].position = -1; },
    ( v ) => { v.palettes[0].name = 'x'.repeat( 121 ); },
    ( v ) => { v.palettes[0].items = Array( 257 ).fill( { type: 'color', hex: '#FFFFFF' } ); },
    ( v ) => { v.palettes = Array( 1001 ).fill( v.palettes[0] ); v.count = 1001; },
  ];
  for ( const mutate of mutations ) {
    const corrupt = structuredClone( original ); mutate( corrupt );
    api.local.data[BACKUP_KEY] = corrupt;
    await assert.rejects( backup.read() );
  }
  await backup.remove();
  assert.equal( await backup.read(), null );
  assert.throws( () => validateDeviceBackup( { ...original, count: 50 } ) );
} );

test( 'pagination rejects duplicate records, cycles and too many pages without replacing old data', async () => {
  for ( const mode of ['duplicate', 'cycle', 'limit'] ) {
    let n = 0;
    const { backup, api } = await fixture( async () => {
      n++;
      return page( [record( mode === 'duplicate' ? 1 : n )], mode === 'cycle' ? 'same' : String( n ) );
    } );
    await assert.rejects( backup.create(), /invalidBackup/ );
    assert.ok( n <= 20 );
    assert.equal( api.local.data[BACKUP_KEY], undefined );
  }
} );

test( 'backup messages are accepted only from trusted extension pages', () => {
  let dispatched = 0;
  const listener = createListener( 'ext', async () => { dispatched++; } );
  for ( const type of ['backup:create', 'backup:read', 'backup:remove', 'backup:open'] ) {
    assert.equal( listener( { type }, { id: 'ext', url: 'https://site.test/' }, () => {} ), false );
    assert.equal( listener( { type }, { id: 'other', url: 'chrome-extension://ext/editor.html' }, () => {} ), false );
  }
  assert.equal( dispatched, 0 );
  assert.equal( listener( { type: 'backup:read' }, { id: 'ext', url: 'chrome-extension://ext/editor.html' }, () => {} ), true );
  assert.equal( dispatched, 1 );
} );

test( 'bounded API response rejects oversize bytes and accepts a valid UTF-8 response', async ( context ) => {
  const original = globalThis.fetch;
  context.after( () => { globalThis.fetch = original; } );
  const client = new ApiClient( 'https://api.test' );
  globalThis.fetch = async () => new Response( JSON.stringify( { name: 'Палітра' } ) );
  assert.equal( ( await client.request( '/test', { maxResponseBytes: 100 } ) ).name, 'Палітра' );
  await assert.rejects( client.request( '/test', { maxResponseBytes: 2 } ), /cloudFailed/ );
} );


test( 'backup survives worker recreation without an API and rejects excessive total bytes', async () => {
  const { backup, storage, store } = await fixture();
  await backup.create();
  await store.clear();
  const restarted = new DeviceBackupService( { storage, store, http: null } );
  assert.equal( ( await restarted.read() ).count, 1 );
  await assert.rejects( restarted.create(), /cloudUnavailable/ );
  const oversized = { version: 1, createdAt: new Date().toISOString(), count: 1000,
    palettes: Array( 1000 ).fill( { name: 'Many colors', items: Array( 256 ).fill( { type: 'color', hex: '#AABBCC' } ) } ) };
  assert.throws( () => validateDeviceBackup( oversized ), /invalidBackup/ );
  await restarted.remove();
  assert.equal( await restarted.read(), null );
} );

test( 'deleting during a storage commit leaves no resurrected backup', async () => {
  const { backup, api } = await fixture();
  const entered = deferred();
  const finish = deferred();
  const original = api.local.set;
  api.local.set = async ( values ) => {
    entered.resolve();
    await finish.promise;
    return original( values );
  };
  const capture = backup.create();
  await entered.promise;
  const deletion = backup.remove();
  finish.resolve();
  await capture;
  await deletion;
  assert.equal( api.local.data[BACKUP_KEY], undefined );
} );


test( 'expiry inside the final commit guard rejects without blocking logout or later captures', async ( context ) => {
  const { backup, api, storage, store } = await fixture();
  await backup.create();
  const previous = structuredClone( api.local.data[BACKUP_KEY] );
  const now = Date.now();
  let clock = now;
  context.mock.method( Date, 'now', () => clock );
  const read = storage.readTemporary.bind( storage );
  let epochReads = 0;
  storage.readTemporary = async ( key ) => {
    const value = await read( key );
    // Capture epoch, before/after pagination, then the locked commit guard.
    if ( ++epochReads === 4 ) clock = now + 120_000;
    return value;
  };
  let timer;
  const outcome = await Promise.race( [
    backup.create().then( () => 'saved', ( error ) => error.code ),
    new Promise( ( resolve ) => { timer = setTimeout( () => resolve( 'blocked' ), 250 ); } ),
  ] );
  clearTimeout( timer );
  assert.equal( outcome, 'sessionChanged' );
  assert.deepEqual( api.local.data[BACKUP_KEY], previous );
  await store.clear();
  assert.equal( await store.session(), null );
  clock = now;
  storage.readTemporary = read;
  const epoch = await store.beginLogin();
  await store.saveSession( { token: 'b'.repeat( 43 ), user: { id: 'two' }, expiresAt: new Date( now + 60_000 ).toISOString() }, epoch );
  await backup.create();
  assert.equal( ( await backup.read() ).count, 1 );
} );
