import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, Fragment, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPaletteExecutor } from './helpers/palette.js';
import { createTestStorage } from './helpers/extensionStorage.js';

test( 'panel and full view require confirmation, show a stale-clear failure and synchronize a successful clear', async () => {
  const dom = new JSDOM( '<div id="root"></div>', { url: 'https://extension.test/editor.html' } );
  const storage = createTestStorage();
  const initial = { id: 'current', name: 'Guest work', colors: [{ id: 'one', hex: '#123456' }] };
  Object.assign( storage.local.data, { language: 'en', currentPalette: initial } );
  const execute = createPaletteExecutor( storage.local, () => 'new' );
  let confirmed = false;
  let conflict = false;
  let clearRequests = 0;
  dom.window.confirm = () => confirmed;
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    chrome: { storage, runtime: { id: 'test', async sendMessage( message ) {
      if ( message.type === 'palette:clear' ) {
        clearRequests++;
        if ( conflict ) {
          conflict = false;
          await execute( { type: 'palette:add', hex: '#ABCDEF' } );
        }
      }
      try { return { ok: true, value: await execute( message ) }; }
      catch ( error ) { return { ok: false, error: error.code || 'storageFailure' }; }
    } } },
  };
  const originals = new Map();
  for ( const [key, value] of Object.entries( globals ) ) {
    originals.set( key, Object.getOwnPropertyDescriptor( globalThis, key ) );
    Object.defineProperty( globalThis, key, { configurable: true, writable: true, value } );
  }
  let server;
  let root;
  try {
    server = await createServer( { server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' } );
    const { default: Page } = await server.ssrLoadModule( '/src/pages/WorkingPalette/WorkingPalettePage.jsx' );
    const { usePalette } = await server.ssrLoadModule( '/src/features/palette/hooks/usePalette.js' );
    const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' );
    await languageReady;
    function View( { panel } ) {
      const { palette } = usePalette();
      return createElement( Page, { palette, panel } );
    }
    root = createRoot( document.getElementById( 'root' ) );
    await act( async () => root.render( createElement( Fragment, null,
      createElement( View, { panel: true } ), createElement( View, { panel: false } ) ) ) );
    const buttons = () => [...document.querySelectorAll( '.palette-clear' )];
    assert.equal( buttons().length, 2 );
    await act( async () => buttons()[0].click() );
    assert.equal( clearRequests, 0 );
    assert.deepEqual( storage.local.data.currentPalette, initial );
    confirmed = true;
    conflict = true;
    await act( async () => buttons()[0].click() );
    assert.equal( storage.local.data.currentPalette.colors.length, 2 );
    assert.ok( document.body.textContent.includes( 'changed in another view' ) );
    const source = { id: 'saved', ownerId: 'account', signature: 'saved' };
    await act( async () => storage.local.set( { currentPalette: { ...initial, cloudSource: source } } ) );
    await act( async () => buttons()[1].click() );
    assert.deepEqual( storage.local.data.currentPalette, { id: 'current', name: '', colors: [] } );
    assert.ok( buttons().every( ( button ) => button.disabled ) );
    assert.equal( document.querySelectorAll( '.palette-grid > li' ).length, 0 );
    assert.ok( document.body.textContent.includes( 'Working palette cleared.' ) );
  } finally {
    if ( root ) await act( async () => root.unmount() );
    await server?.close();
    dom.window.close();
    for ( const [key, descriptor] of originals ) {
      if ( descriptor ) Object.defineProperty( globalThis, key, descriptor );
      else delete globalThis[key];
    }
  }
} );
