import test from 'node:test';
import assert from 'node:assert/strict';
import { ChromeSessionStorage } from '@/features/auth/adapters/chromeSessionStorage.js';
import { subscribeToAccountEvents } from '@/features/auth/adapters/accountEvents.js';
import { SessionStore } from '@/features/auth/services/sessionStore.js';
import { SavedPaletteService } from '@/features/saved-palettes/services/savedPaletteService.js';
import { SavedPalettesModel } from '@/features/saved-palettes/models/savedPalettesModel.js';
import { createListener } from '@/extension/messaging/createListener.js';
import { dispatchLibraryMessage } from '@/extension/messaging/dispatchLibraryMessage.js';
import { EXTENSION_PAGES } from '@/constants/extensionPages.js';
import { createTestStorage } from './helpers/extensionStorage.js';

const settle = () => new Promise( ( resolve ) => setImmediate( resolve ) );
const identity = ( id ) => ( {
  token: id.repeat( 43 ), user: { id, email: id + '@example.test' },
  expiresAt: new Date( Date.now() + 86_400_000 ).toISOString(),
} );

test( 'all extension pages read the same worker session and follow account changes and logout', async () => {
  const storage = createTestStorage();
  const store = new SessionStore( new ChromeSessionStorage( storage ) );
  await store.saveSession( identity( 'A' ), await store.beginLogin() );
  const service = new SavedPaletteService( { store, http: {}, login: {}, palette: {} } );
  const extensionId = 'a'.repeat( 32 );
  const listener = createListener( extensionId, ( message ) => dispatchLibraryMessage( service, message ) );
  const models = Object.values( EXTENSION_PAGES ).map( ( page ) => {
    const sender = { id: extensionId, url: 'chrome-extension://' + extensionId + '/' + page };
    return new SavedPalettesModel( {
      getLibraryState: () => new Promise( ( resolve, reject ) => {
        const accepted = listener( { type: 'cloud:state' }, sender, ( response ) => {
          if ( response.ok ) resolve( response.value );
          else reject( new Error( response.error ) );
        } );
        if ( !accepted ) reject( new Error( 'Session request rejected for ' + page ) );
      } ),
      listSavedPalettes: () => assert.fail( 'Menus must not load the library library' ),
    }, { loadLibrary: false } );
  } );
  const unsubscribe = subscribeToAccountEvents( {
    onSessionChange: () => { for ( const model of models ) model.sessionChanged(); },
    onPendingChange: () => { for ( const model of models ) void model.refresh(); },
  }, storage );
  try {
    for ( const model of models ) model.start();
    await settle();
    for ( const model of models ) {
      assert.equal( model.getSnapshot().stateError, null );
      assert.equal( model.getSnapshot().user?.id, 'A' );
    }
    await store.saveSession( identity( 'B' ), await store.beginLogin() );
    await settle();
    for ( const model of models ) assert.equal( model.getSnapshot().user?.id, 'B' );
    await store.clear();
    await settle();
    for ( const model of models ) {
      assert.equal( model.getSnapshot().user, null );
      assert.equal( model.getSnapshot().stateError, null );
    }
  } finally {
    unsubscribe();
    for ( const model of models ) model.stop();
  }
  assert.equal( storage.listeners.size, 0 );
} );
