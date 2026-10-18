import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSessionStore } from '@/cloud/sessionStore.js';
import { CloudService } from '@/cloud/cloudService.js';
import { CloudLibraryModel } from '@/cloud/libraryModel.js';
import { createListener } from '@/runtime/createListener.js';
import { dispatchCloudMessage } from '@/runtime/dispatchCloudMessage.js';
import { EXTENSION_PAGES } from '@/constants/extensionPages.js';
import { createCloudStorage } from './helpers/cloudStorage.js';

const settle = () => new Promise( ( resolve ) => setImmediate( resolve ) );
const identity = ( id ) => ( {
  token: id.repeat( 43 ), user: { id, email: id + '@example.test' },
  expiresAt: new Date( Date.now() + 86_400_000 ).toISOString(),
} );

test( 'all extension pages read the same worker session and follow account changes and logout', async () => {
  const storage = createCloudStorage();
  const store = new CloudSessionStore( storage );
  await store.saveSession( identity( 'A' ), await store.beginLogin() );
  const service = new CloudService( { store, http: {}, login: {}, palette: {} } );
  const extensionId = 'a'.repeat( 32 );
  const listener = createListener( extensionId, ( message ) => dispatchCloudMessage( service, message ) );
  const models = Object.values( EXTENSION_PAGES ).map( ( page ) => {
    const sender = { id: extensionId, url: 'chrome-extension://' + extensionId + '/' + page };
    return new CloudLibraryModel( {
      getCloudState: () => new Promise( ( resolve, reject ) => {
        const accepted = listener( { type: 'cloud:state' }, sender, ( response ) => {
          if ( response.ok ) resolve( response.value );
          else reject( new Error( response.error ) );
        } );
        if ( !accepted ) reject( new Error( 'Session request rejected for ' + page ) );
      } ),
      listCloudPalettes: () => assert.fail( 'Menus must not load the cloud library' ),
    }, { loadLibrary: false } );
  } );
  const changed = ( changes, area ) => {
    if ( area === 'local' && Object.hasOwn( changes, 'cloudSession' ) ) {
      for ( const model of models ) model.sessionChanged();
    }
  };
  storage.onChanged.addListener( changed );
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
    storage.onChanged.removeListener( changed );
    for ( const model of models ) model.stop();
  }
} );
