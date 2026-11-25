import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act } from 'react';
import { createTestStorage } from './helpers/extensionStorage.js';

// Real App + worker + storage; substitute only Chrome, clipboard and network APIs.
test( 'local-only entries and legacy routes stay offline and preserve account data and local backups', async () => {
  const dom = new JSDOM( '<div id="root"></div>', { url: 'https://extension.test/editor.html' } );
  const original = new Map();
  const event = () => ( { addListener() {} } );
  let root;
  let server;
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  for ( const key of [...Object.keys( globals ), 'chrome', 'fetch'] ) original.set( key, Object.getOwnPropertyDescriptor( globalThis, key ) );
  for ( const [key, value] of Object.entries( globals ) ) Object.defineProperty( globalThis, key, { configurable: true, writable: true, value } );
  window.confirm = () => true;
  Object.defineProperty( navigator, 'clipboard', { value: { writeText: async () => {} } } );
  try {
    const { createRoot } = await import( 'react-dom/client' );
    for ( const flag of ['false', undefined] ) {
      const storage = createTestStorage();
      const session = { token: 'a'.repeat( 43 ), user: { id: 'existing' }, expiresAt: '2020-01-01T00:00:00Z' };
      const pending = { key: 'keep-pending', ownerId: 'existing' };
      const backup = { version: 1, createdAt: '2026-11-20T12:00:00.000Z', count: 1, palettes: [{ name: 'Offline set', items: [{ type: 'color', hex: '#112233' }] }] };
      Object.assign( storage.local.data, { language: 'en', cloudSession: session, devicePaletteBackup: backup,
        currentPalette: { id: 'current', name: 'Keep', colors: [{ id: 'one', hex: '#AABBCC' }] } } );
      storage.session.data.cloudPendingSave = pending;
      storage.session.data.cloudEpoch = 'keep-epoch';
      const messages = [];
      let listener;
      let senderPage = 'editor.html';
      let networkCalls = 0;
      let oauthCalls = 0;
      const chromeApi = {
        storage,
        runtime: { id: 'test', getURL: path => 'chrome-extension://test/' + path,
          onMessage: { addListener: value => { listener = value; } },
          sendMessage: message => {
            messages.push( message.type );
            return new Promise( ( resolve, reject ) => {
              if ( !listener( message, { id: 'test', url: 'chrome-extension://test/' + senderPage }, resolve ) ) reject( new Error( 'Rejected message' ) );
            } );
          },
        },
        identity: { launchWebAuthFlow: async () => { oauthCalls++; throw new Error( 'Unexpected OAuth' ); } },
        sidePanel: { setOptions: async () => {}, setPanelBehavior: async () => {} },
        tabs: { query: async () => [], onCreated: event(), onUpdated: event(), onActivated: event(), onRemoved: event(), onReplaced: event() },
      };
      Object.defineProperty( globalThis, 'chrome', { configurable: true, writable: true, value: chromeApi } );
      Object.defineProperty( globalThis, 'fetch', { configurable: true, writable: true, value: async () => { networkCalls++; throw new Error( 'Unexpected network' ); } } );
      server = await createServer( { envDir: false,
        define: { 'import.meta.env.VITE_ENABLE_CLOUD': flag === undefined ? 'undefined' : JSON.stringify( flag ),
          'import.meta.env.VITE_PALETTE_API_URL': JSON.stringify( 'https://unavailable.example.test' ) },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
      } );
      await server.ssrLoadModule( '/src/extension/background.js' );
      const { default: App } = await server.ssrLoadModule( '/src/App.jsx' );
      const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' );
      await languageReady;
      for ( const [file, panel, initialPage] of [
        ['sidepanel.html', true, 'working'], ['editor.html', false, 'working'],
        ['library.html', false, 'library'], ['print.html', false, 'print'],
      ] ) {
        senderPage = file;
        window.history.replaceState( null, '', '/' + file );
        root = createRoot( document.getElementById( 'root' ) );
        await act( async () => root.render( createElement( App, { panel, initialPage } ) ) );
        assert.equal( document.querySelector( '.app-account' ), null );
        assert.equal( document.querySelector( '.saved-confirm' ), null );
        assert.equal( document.querySelectorAll( '.app-navigation-pages a' ).length, 2 );
        assert.ok( !document.querySelector( '.app-navigation-pages a[href*="library"]' ) );
        assert.ok( !document.querySelector( 'button[aria-label="Save palette"]' ) );
        assert.ok( !document.body.textContent.includes( 'Sign in with Google' ) );
        const active = () => document.querySelector( '.app-navigation-pages a[aria-current="page"]' );
        assert.equal( active().textContent, initialPage === 'print' ? 'Print / PDF' : 'Working palette' );
        for ( const eventName of ['hashchange', 'popstate'] ) {
          await act( async () => {
            window.history.replaceState( null, '', '#view=library' );
            window.dispatchEvent( new window.Event( eventName ) );
          } );
          assert.equal( active().textContent, 'Working palette' );
          assert.equal( window.location.hash, '#view=working' );
        }
        await act( async () => {
          window.dispatchEvent( new window.Event( 'focus' ) );
          await storage.session.set( { cloudPendingSave: pending } );
          await storage.local.set( { cloudSession: session } );
        } );
        assert.equal( messages.filter( type => type.startsWith( 'cloud:' ) ).length, 0 );
        assert.equal( messages.filter( type => type.startsWith( 'backup:' ) ).length, 0 );
        await act( async () => document.querySelector( '.app-navigation-pages a[href*="print"]' ).click() );
        assert.equal( active().textContent, 'Print / PDF' );
        await act( async () => document.querySelector( '.app-navigation-pages a[href*="working"]' ).click() );
        await act( async () => root.unmount() ); root = null;
      }
      root = createRoot( document.getElementById( 'root' ) );
      window.history.replaceState( null, '', '#view=working' );
      await act( async () => root.render( createElement( App ) ) );
      assert.equal( [...document.querySelectorAll( 'button' )].some( button => button.textContent === 'Save backup on this device' ), false );
      await act( async () => document.querySelector( '.local-backup summary' ).click() );
      await act( async () => [...document.querySelectorAll( 'button' )].find( button => button.textContent === 'View device backup' ).click() );
      assert.ok( document.querySelector( '.local-backup' ).textContent.includes( 'Offline set' ) );
      await act( async () => [...document.querySelectorAll( 'button' )].find( button => button.textContent === 'Open as working palette' ).click() );
      assert.equal( storage.local.data.currentPalette.colors[0].hex, '#112233' );
      await act( async () => root.unmount() ); root = null;
      // Disabled cloud commands cannot clear the existing account or launch login.
      assert.deepEqual( await chromeApi.runtime.sendMessage( { type: 'cloud:state' } ), { ok: true, value: { configured: false, user: null, pending: null } } );
      for ( const type of ['cloud:signIn', 'cloud:logout', 'cloud:prepare', 'cloud:save', 'cloud:list'] ) {
        const result = await chromeApi.runtime.sendMessage( { type } );
        assert.equal( result.ok, false ); assert.equal( result.error, 'cloudUnavailable' );
      }
      assert.deepEqual( ( await chromeApi.runtime.sendMessage( { type: 'backup:read' } ) ).value, backup );
      assert.deepEqual( storage.local.data.cloudSession, session );
      assert.deepEqual( storage.session.data.cloudPendingSave, pending );
      assert.equal( storage.session.data.cloudEpoch, 'keep-epoch' );
      assert.deepEqual( storage.local.data.devicePaletteBackup, backup );
      assert.equal( networkCalls, 0 ); assert.equal( oauthCalls, 0 );
      await server.close(); server = null;
    }
  } finally {
    if ( root ) await act( async () => root.unmount() );
    await server?.close(); dom.window.close();
    for ( const [key, descriptor] of original ) {
      if ( descriptor ) Object.defineProperty( globalThis, key, descriptor ); else delete globalThis[key];
    }
  }
} );
