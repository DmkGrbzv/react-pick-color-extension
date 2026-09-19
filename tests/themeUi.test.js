import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

test( 'theme controls synchronize, reject stale reads, report failed saves, and clean up in StrictMode', async () => {
  const dom = new JSDOM( '<div id="root"></div>', { url: 'https://extension.test/editor.html' } );
  const listeners = new Set();
  const stored = { language: 'en', theme: 'light' };
  const pendingReads = [];
  let delayReads = true;
  let failWrite = false;
  let writes = 0;
  const storage = {
    local: {
      async get( key ) {
        const snapshot = { [key]: stored[key] };
        if ( key === 'theme' && delayReads ) {
          await new Promise( ( resolve ) => pendingReads.push( resolve ) );
        }
        return snapshot;
      },
      async set( values ) {
        if ( failWrite ) throw new Error( 'Write failed' );
        writes++;
        Object.assign( stored, values );
        const changes = Object.fromEntries(
          Object.entries( values ).map( ( [key, newValue] ) => [key, { newValue }] )
        );
        for ( const listener of listeners ) listener( changes, 'local' );
      },
    },
    onChanged: {
      addListener: ( listener ) => listeners.add( listener ),
      removeListener: ( listener ) => listeners.delete( listener ),
    },
  };
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    chrome: { runtime: { id: 'test' }, storage },
  };
  const originals = new Map();
  for ( const [key, value] of Object.entries( globals ) ) {
    originals.set( key, Object.getOwnPropertyDescriptor( globalThis, key ) );
    Object.defineProperty( globalThis, key, { configurable: true, writable: true, value } );
  }
  let server;
  let root;
  try {
    server = await createServer( {
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'custom',
    } );
    const { default: ThemeToggle } = await server.ssrLoadModule( '/src/components/ThemeToggle.jsx' );
    const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' );
    await languageReady;
    const initialListenerCount = listeners.size;
    root = createRoot( document.getElementById( 'root' ) );
    await act( async () =>
      root.render(
        createElement(
          StrictMode,
          null,
          ...['panel', 'editor', 'print'].map( ( key ) => createElement( ThemeToggle, { key } ) )
        )
      )
    );
    assert.equal( listeners.size, initialListenerCount + 3 );
    await act( async () => {
      await storage.local.set( { theme: 'dark' } );
      pendingReads.forEach( ( resolve ) => resolve() );
    } );
    assert.equal( document.documentElement.dataset.theme, 'dark' );
    const pressed = () =>
      [...document.querySelectorAll( '[aria-pressed="true"]' )].map( ( button ) =>
        button.getAttribute( 'aria-label' )
      );
    assert.deepEqual( pressed(), ['Dark theme', 'Dark theme', 'Dark theme'] );
    const light = document.querySelector( '[aria-label="Light theme"]' );
    failWrite = true;
    await act( async () => light.click() );
    assert.ok( document.querySelector( '[role="alert"]' ) );
    assert.equal( document.documentElement.dataset.theme, 'dark' );
    failWrite = false;
    await act( async () => light.click() );
    assert.equal( stored.theme, 'light' );
    assert.deepEqual( pressed(), ['Light theme', 'Light theme', 'Light theme'] );
    assert.equal( document.querySelector( '[role="alert"]' ), null );
    const dark = document.querySelector( '[aria-label="Dark theme"]' );
    const before = writes;
    await act( async () => {
      dark.click();
      dark.click();
    } );
    assert.equal( writes, before + 1 );
    await act( async () => root.unmount() );
    root = null;
    assert.equal( listeners.size, initialListenerCount );
    delayReads = false;
    root = createRoot( document.getElementById( 'root' ) );
    await act( async () => root.render( createElement( ThemeToggle ) ) );
    assert.deepEqual( pressed(), ['Dark theme'] );
    await act( async () => storage.local.set( { theme: undefined } ) );
    assert.equal( document.documentElement.dataset.theme, 'light' );
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
