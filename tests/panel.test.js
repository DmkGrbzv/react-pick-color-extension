import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenEditor } from '@/openEditorTab.js';
import { PanelController, registerPanelEvents } from '@/panelController.js';
import { PaletteSubscription } from '@/paletteSubscription.js';

function event() {
  const listeners = [];
  return {
    addListener: ( listener ) => listeners.push( listener ),
    emit: ( ...args ) => listeners.forEach( ( listener ) => listener( ...args ) ),
  };
}

function setup( tabs = [] ) {
  const state = {
    tabs: structuredClone( tabs ),
    options: new Map(),
    actions: new Map(),
    calls: [],
    nextId: 100,
    defaults: { enabled: false },
    failCreate: false,
  };
  const api = {
    runtime: { getURL: ( path ) => `chrome-extension://test/${path}` },
    tabs: {
      onCreated: event(),
      onUpdated: event(),
      onActivated: event(),
      onRemoved: event(),
      onReplaced: event(),
      async get( id ) {
        const tab = state.tabs.find( ( tab ) => tab.id === id );
        if ( !tab ) throw new Error( 'Tab removed' );
        return structuredClone( tab );
      },
      async query( { windowId } = {} ) {
        return structuredClone(
          state.tabs.filter( ( tab ) => windowId === undefined || tab.windowId === windowId )
        );
      },
      async create( options ) {
        if ( state.failCreate ) {
          state.failCreate = false;
          throw new Error( 'Create failed' );
        }
        const tab = { id: state.nextId++, ...options };
        state.calls.push( ['create', options] );
        state.tabs.push( tab );
        api.tabs.onCreated.emit( tab );
        return structuredClone( tab );
      },
      async update( id, options ) {
        const tab = state.tabs.find( ( tab ) => tab.id === id );
        if ( !tab ) throw new Error( 'Tab removed' );
        state.calls.push( ['activate', id] );
        assert.equal(
          state.options.get( id )?.enabled ?? state.defaults.enabled,
          false,
          'editor panel disabled before activation'
        );
        Object.assign( tab, options );
        return structuredClone( tab );
      },
    },
    action: {
      async enable( id ) {
        state.actions.set( id, true );
      },
      async disable( id ) {
        state.actions.set( id, false );
      },
    },
    sidePanel: {
      async getOptions( { tabId } ) {
        return structuredClone( state.options.get( tabId ) ?? state.defaults );
      },
      async setOptions( options ) {
        state.calls.push( ['options', structuredClone( options )] );
        if ( options.tabId === undefined ) Object.assign( state.defaults, options );
        else state.options.set( options.tabId, { ...state.options.get( options.tabId ), ...options } );
      },
      async setPanelBehavior( options ) {
        state.behavior = options;
      },
      open() {
        assert.fail( 'Panel must not be opened programmatically' );
      },
      close() {
        assert.fail( 'Panel must not be closed programmatically' );
      },
    },
  };
  const panel = new PanelController( api );
  return { api, state, panel };
}

const editorUrl = 'chrome-extension://test/editor.html';
const site = ( id, windowId = 1 ) => ( { id, windowId, url: 'https://example.com' } );
const editor = ( id, windowId = 1 ) => ( { id, windowId, url: editorUrl } );

test( 'startup configures tab-specific site panels and disables direct/restored editors', async () => {
  const { panel, state } = setup( [site( 1 ), editor( 2 ), site( 3, 2 ), editor( 4, 2 )] );
  await panel.initialize();
  assert.equal( state.defaults.enabled, false );
  assert.deepEqual( state.behavior, { openPanelOnActionClick: true } );
  for ( const id of [1, 3] ) {
    assert.deepEqual( state.options.get( id ), { tabId: id, enabled: true, path: 'sidepanel.html' } );
    assert.equal( state.actions.get( id ), true );
  }
  for ( const id of [2, 4] ) {
    assert.equal( state.options.get( id )?.enabled ?? state.defaults.enabled, false );
    assert.equal( state.actions.get( id ), false );
  }
} );

test( 'returning to a site and restarting worker do not reset its panel settings', async () => {
  const { api, panel, state } = setup( [site( 1 ), editor( 2 )] );
  await panel.initialize();
  state.calls = [];
  await panel.sync( 2 );
  await panel.sync( 1 );
  assert.deepEqual( state.calls, [] );
  await new PanelController( api ).initialize();
  assert.deepEqual( state.calls, [['options', { enabled: false }]] );
  // Visibility (open, manually closed, never opened) remains entirely Chrome-owned.
} );

test( 'navigating editor to site enables it; reloading or navigating into editor disables it', async () => {
  const { panel, state } = setup( [site( 1 ), site( 2, 2 )] );
  await panel.initialize();
  state.calls = [];
  state.tabs[0].pendingUrl = editorUrl + '#palette';
  await panel.sync( 1 );
  assert.equal( state.options.get( 1 ).enabled, false );
  assert.equal( state.actions.get( 1 ), false );
  await panel.sync( 1 );
  assert.equal( state.calls.length, 1 );
  state.tabs[0].pendingUrl = 'https://other.example';
  await panel.sync( 1 );
  assert.equal( state.options.get( 1 ).enabled, true );
  assert.equal( state.actions.get( 1 ), true );
  assert.ok( state.calls.every( ( [, options] ) => options.tabId === 1 ) );
} );

test( 'rapid editor requests share one creation and disable the panel before activation', async () => {
  const { api, state, panel } = setup( [site( 1 )] );
  await panel.initialize();
  const open = createOpenEditor( api, panel );
  assert.deepEqual( await Promise.all( [open( 1 ), open( 1 ), open( 1 )] ), [100, 100, 100] );
  assert.equal( state.calls.filter( ( [name] ) => name === 'create' ).length, 1 );
  assert.deepEqual( state.calls.find( ( [name] ) => name === 'create' )[1], {
    url: editorUrl,
    windowId: 1,
    active: false,
  } );
  assert.equal( state.actions.get( 100 ), false );
  assert.equal( state.options.get( 1 ).enabled, true );
} );

test( 'each window reuses its own editor; requests in different windows do not share a lock', async () => {
  const { api, state, panel } = setup( [site( 1 ), site( 2, 2 )] );
  const open = createOpenEditor( api, panel );
  const [first, second] = await Promise.all( [open( 1 ), open( 2 )] );
  assert.notEqual( first, second );
  assert.equal( state.tabs.find( ( tab ) => tab.id === first ).windowId, 1 );
  assert.equal( state.tabs.find( ( tab ) => tab.id === second ).windowId, 2 );
  const restarted = createOpenEditor( api, new PanelController( api ) );
  assert.equal( await restarted( 1 ), first );
  assert.equal( await restarted( 2 ), second );
  assert.equal( state.calls.filter( ( [name] ) => name === 'create' ).length, 2 );
} );

test( 'existing editor in another window is not activated or used', async () => {
  const { api, state, panel } = setup( [site( 1 ), editor( 2, 2 )] );
  const id = await createOpenEditor( api, panel )( 1 );
  assert.notEqual( id, 2 );
  assert.equal( state.tabs.find( ( tab ) => tab.id === id ).windowId, 1 );
  assert.ok( !state.calls.some( ( [name, id] ) => name === 'activate' && id === 2 ) );
  assert.ok( !state.actions.has( 2 ) );
} );

test( 'pending editor URLs and query/hash variants are reused within the current window', async () => {
  const { api, state, panel } = setup( [
    { id: 1, windowId: 1, url: 'https://example.com/editor.html' },
    { id: 2, windowId: 1, pendingUrl: editorUrl + '?restored=1#palette' },
  ] );
  assert.equal( await createOpenEditor( api, panel )( 1 ), 2 );
  assert.ok( !state.calls.some( ( [name] ) => name === 'create' ) );
} );

test( 'closing editor permits a new one; create failure does not poison the window lock', async () => {
  const { api, state, panel } = setup( [site( 1 )] );
  const open = createOpenEditor( api, panel );
  state.failCreate = true;
  await assert.rejects( open( 1 ), /Create failed/ );
  const first = await open( 1 );
  state.tabs = state.tabs.filter( ( tab ) => tab.id !== first );
  panel.forget( first );
  const second = await open( 1 );
  assert.notEqual( first, second );
  await assert.rejects( open( undefined ), /source window/ );
} );

test( 'tab lifecycle handlers synchronize created/updated/activated/replaced tabs and forget removed ones', () => {
  const { api } = setup();
  const synced = [];
  const forgotten = [];
  registerPanelEvents( api, {
    sync: async ( id ) => {
      synced.push( id );
    },
    forget: ( id ) => {
      forgotten.push( id );
    },
  } );
  api.tabs.onCreated.emit( { id: 1 } );
  api.tabs.onUpdated.emit( 2, { status: 'loading' } );
  api.tabs.onUpdated.emit( 3, { url: editorUrl } );
  api.tabs.onUpdated.emit( 4, { title: 'Ignored' } );
  api.tabs.onActivated.emit( { tabId: 5 } );
  api.tabs.onReplaced.emit( 6, 7 );
  api.tabs.onRemoved.emit( 8 );
  assert.deepEqual( synced, [1, 2, 3, 5, 6] );
  assert.deepEqual( forgotten, [7, 8] );
} );

test( 'removed tabs cancel queued configuration without touching other tabs', async () => {
  const { panel, state } = setup( [site( 1 )] );
  const operation = panel.sync( 1 );
  panel.forget( 1 );
  await operation;
  assert.deepEqual( state.calls, [] );
} );

test( 'palette refresh never overwrites a newer storage event or a newer read', async () => {
  const reads = [];
  const values = [];
  let notify;
  const subscription = new PaletteSubscription( {
    read: () => new Promise( ( resolve ) => reads.push( resolve ) ),
    subscribe: ( onValue ) => {
      notify = onValue;
      return () => {};
    },
    onValue: ( value ) => values.push( value ),
    onError: () => assert.fail( 'Unexpected error' ),
  } );
  const initial = subscription.refresh();
  notify( 'fresh event' );
  reads[0]( 'stale initial' );
  await initial;
  assert.deepEqual( values, ['fresh event'] );
  const first = subscription.refresh();
  const second = subscription.refresh();
  reads[2]( 'fresh read' );
  await second;
  reads[1]( 'stale read' );
  await first;
  assert.deepEqual( values, ['fresh event', 'fresh read'] );
  const closing = subscription.refresh();
  subscription.dispose();
  reads[3]( 'after disposal' );
  await closing;
  assert.deepEqual( values, ['fresh event', 'fresh read'] );
} );

test( 'palette refresh recovers from errors and unsubscribes on disposal', async () => {
  const values = [];
  const errors = [];
  let fail = true;
  let stopped = false;
  const subscription = new PaletteSubscription( {
    read: async () => {
      if ( fail ) throw new Error( 'offline' );
      return 'saved palette';
    },
    subscribe: () => () => {
      stopped = true;
    },
    onValue: ( value ) => values.push( value ),
    onError: ( error ) => errors.push( error.message ),
  } );
  await subscription.refresh();
  fail = false;
  await subscription.refresh();
  assert.deepEqual( errors, ['offline'] );
  assert.deepEqual( values, ['saved palette'] );
  subscription.dispose();
  assert.equal( stopped, true );
} );

test( 'gradient edit requests reuse editor and deliver successive targets via hash without reloading the page', async () => {
  const { api, state, panel } = setup( [site( 1 ), editor( 2 )] );
  const open = createOpenEditor( api, panel );
  await open( 1, 'gradient-one' );
  let target = new URL( state.tabs.find( ( tab ) => tab.id === 2 ).url );
  assert.equal( new URLSearchParams( target.hash.slice( 1 ) ).get( 'gradient' ), 'gradient-one' );
  const firstHash = target.hash;
  await open( 1, 'gradient-one' );
  target = new URL( state.tabs.find( ( tab ) => tab.id === 2 ).url );
  assert.notEqual( target.hash, firstHash );
  await Promise.all( [open( 1, 'gradient-two' ), open( 1, 'gradient-three' )] );
  target = new URL( state.tabs.find( ( tab ) => tab.id === 2 ).url );
  assert.equal( new URLSearchParams( target.hash.slice( 1 ) ).get( 'gradient' ), 'gradient-three' );
  assert.equal( target.pathname, '/editor.html' );
  assert.ok( !state.calls.some( ( [name] ) => name === 'create' ) );
} );

test( 'a failed panel request rejects its caller while the next queued request retries', async () => {
  const { api, panel, state } = setup( [{ id: 1, windowId: 1, url: 'https://example.com' }] );
  const setOptions = api.sidePanel.setOptions;
  const failure = new Error( 'Temporary settings failure' );
  let attempts = 0;
  api.sidePanel.setOptions = async ( options ) => {
    attempts++;
    if ( attempts === 1 ) throw failure;
    await setOptions( options );
  };
  const first = panel.sync( 1 );
  const second = panel.sync( 1 );
  const [failed, retried] = await Promise.allSettled( [first, second] );
  assert.equal( failed.status, 'rejected' );
  assert.equal( failed.reason, failure );
  assert.equal( retried.status, 'fulfilled' );
  assert.equal( attempts, 2 );
  assert.equal( state.options.get( 1 ).enabled, true );
  await panel.sync( 1 );
  assert.equal( attempts, 2, 'Already applied settings should not be written again' );
} );
