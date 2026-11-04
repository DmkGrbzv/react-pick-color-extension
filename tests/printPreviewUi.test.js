import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createTestStorage } from './helpers/extensionStorage.js';

test( 'narrow print views offer full view or resizing, preserve settings and clean up their size observer', async () => {
  const dom = new JSDOM( '<div id="root"></div>' );
  const storage = createTestStorage();
  storage.local.data.language = 'en';
  let notify;
  let disconnected = 0;
  let opened = 0;
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true, chrome: { storage },
    ResizeObserver: class {
      constructor( callback ) { notify = callback; }
      observe() {}
      disconnect() { disconnected++; }
    },
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
    const { default: Page } = await server.ssrLoadModule( '/src/pages/Print/PrintPage.jsx' );
    const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' );
    await languageReady;
    root = createRoot( document.getElementById( 'root' ) );
    const props = { palette: { id: 'current', name: 'Test', colors: [] }, panel: true,
      onOpenFull: () => opened++ };
    await act( async () => root.render( createElement( Page, props ) ) );
    const resize = async ( width ) => act( async () => notify( [{ contentRect: { width } }] ) );
    await resize( 480 );
    assert.equal( document.querySelector( '.print-full-view-hint' ).hidden, false );
    assert.equal( document.querySelector( '.print-preview-content' ).hidden, true );
    assert.equal( document.querySelector( '.print-controls button' ).disabled, true );
    await act( async () => document.querySelector( '.print-full-view-hint button' ).click() );
    assert.equal( opened, 1 );
    await resize( 1000 );
    assert.equal( document.querySelector( '.print-preview-content' ).hidden, false );
    const orientation = document.querySelector( '.print-settings-grid select' );
    await act( async () => {
      orientation.value = 'landscape';
      orientation.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
    } );
    const scale = Number( document.querySelector( '.print-preview' ).style.getPropertyValue( '--print-preview-scale' ) );
    assert.ok( scale > 0 && scale < 1 );
    await resize( 480 );
    await act( async () => root.render( createElement( Page, { ...props, panel: false } ) ) );
    assert.equal( document.querySelector( '.print-full-view-hint button' ), null );
    assert.ok( document.querySelector( '.print-full-view-hint' ).textContent.includes( 'Widen this window' ) );
    await resize( 1000 );
    assert.equal( document.querySelector( '.print-settings-grid select' ).value, 'landscape' );
    await act( async () => root.unmount() );
    root = null;
    assert.equal( disconnected, 1 );
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
