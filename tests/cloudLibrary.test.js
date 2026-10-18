import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudLibraryModel } from '@/cloud/libraryModel.js';
import { deferred } from './helpers/cloudStorage.js';

const settle = () => new Promise( ( resolve ) => setImmediate( resolve ) );
const session = ( id ) => ( {
  sessionId: id, user: { id, expiresAt: new Date( Date.now() + 60_000 ).toISOString() }, pending: null,
} );

test( 'a successful state refresh preserves a library failure until its explicit retry succeeds', async () => {
  let offline = true;
  const model = new CloudLibraryModel( {
    getCloudState: async () => session( 'A' ),
    listCloudPalettes: async () => {
      if ( offline ) throw new Error( 'Offline' );
      return { palettes: [{ id: 'one' }], nextCursor: null };
    },
  } );
  model.start();
  try {
    await settle();
    assert.ok( model.getSnapshot().libraryError );
    await model.refresh();
    assert.ok( model.getSnapshot().libraryError );
    offline = false;
    await model.refresh( true );
    assert.equal( model.getSnapshot().libraryError, null );
    assert.deepEqual( model.getSnapshot().palettes, [{ id: 'one' }] );
  } finally {
    model.stop();
  }
} );

test( 'SPA starts without fetching sets and loads the current account only when its library screen is activated', async () => {
  let state = session( 'A' );
  let requests = 0;
  const model = new CloudLibraryModel( {
    getCloudState: async () => state,
    listCloudPalettes: async () => {
      requests++;
      return { palettes: [{ id: state.user.id + '-set' }], nextCursor: null };
    },
  }, { loadLibrary: false } );
  model.start();
  try {
    await settle();
    assert.equal( requests, 0 );
    model.setLibraryActive( true );
    await settle();
    assert.deepEqual( model.getSnapshot().palettes, [{ id: 'A-set' }] );
    model.setLibraryActive( false );
    state = session( 'B' );
    model.sessionChanged();
    await settle();
    assert.equal( requests, 1 );
    assert.deepEqual( model.getSnapshot().palettes, [] );
    model.setLibraryActive( true );
    await settle();
    assert.equal( requests, 2 );
    assert.deepEqual( model.getSnapshot().palettes, [{ id: 'B-set' }] );
  } finally {
    model.stop();
  }
} );

test( 'library discards old account responses and clears private state on logout', async () => {
  let state = session( 'A' );
  const oldPage = deferred();
  let requests = 0;
  const model = new CloudLibraryModel( {
    getCloudState: async () => state,
    listCloudPalettes: async () => ++requests === 1 ? oldPage.promise : { palettes: [{ id: 'B-set' }], nextCursor: null },
  } );
  model.start();
  await settle();
  state = session( 'B' );
  model.sessionChanged();
  await settle();
  assert.equal( model.getSnapshot().user.id, 'B' );
  oldPage.resolve( { palettes: [{ id: 'A-private' }], nextCursor: null } );
  await settle();
  assert.deepEqual( model.getSnapshot().palettes, [{ id: 'B-set' }] );
  state = { sessionId: null, user: null, pending: null };
  model.sessionChanged();
  await settle();
  assert.deepEqual( model.getSnapshot().palettes, [] );
  model.stop();
} );

test( 'pagination merges by set ID and disposed views ignore delayed updates', async () => {
  let page = 0;
  const delayed = deferred();
  const model = new CloudLibraryModel( {
    getCloudState: async () => session( 'A' ),
    listCloudPalettes: async () => ++page === 1
      ? { palettes: [{ id: 'one' }], nextCursor: 'next' }
      : page === 2 ? { palettes: [{ id: 'one' }, { id: 'two' }], nextCursor: 'last' }
        : delayed.promise,
  } );
  model.start();
  await settle();
  await model.loadMore();
  assert.deepEqual( model.getSnapshot().palettes.map( ( item ) => item.id ), ['one', 'two'] );
  const loading = model.loadMore();
  const before = model.getSnapshot();
  model.stop();
  delayed.resolve( { palettes: [{ id: 'three' }], nextCursor: null } );
  await loading;
  assert.equal( model.getSnapshot(), before );
} );

test( 'deletion removes the card and details only after success, ignoring an older list response', async () => {
  const stalePage = deferred();
  let pages = 0;
  let fail = true;
  const model = new CloudLibraryModel( {
    getCloudState: async () => session( 'A' ),
    listCloudPalettes: async () => ++pages === 1
      ? { palettes: [{ id: 'one' }, { id: 'two' }], nextCursor: null } : stalePage.promise,
    getCloudPalette: async () => ( { id: 'one' } ),
    deleteCloudPalette: async () => { if ( fail ) throw new Error( 'Offline' ); },
  } );
  model.start();
  await settle();
  await model.details( 'one' );
  await model.remove( 'one' );
  assert.equal( model.getSnapshot().palettes.length, 2 );
  assert.equal( model.getSnapshot().detail.id, 'one' );
  const loading = model.loadMore( true );
  fail = false;
  await model.remove( 'one' );
  assert.deepEqual( model.getSnapshot().palettes, [{ id: 'two' }] );
  assert.equal( model.getSnapshot().detail, null );
  stalePage.resolve( { palettes: [{ id: 'one' }, { id: 'two' }], nextCursor: null } );
  await loading;
  assert.deepEqual( model.getSnapshot().palettes, [{ id: 'two' }] );
  model.stop();
} );
