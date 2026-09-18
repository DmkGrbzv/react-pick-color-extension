import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPaletteExecutor } from './helpers/palette.js';
import { colorValues } from '@/utils/colorConversion.js';

// Mount real components with the real palette service, replacing only browser APIs.
test( 'advisor previews without writes, adds explicitly, rejects duplicates and stays scoped to one source', async () => {
  const dom = new JSDOM( '<div id="root"></div>', { url: 'https://extension.test/editor.html' } );
  const initial = {
    id: 'current',
    name: 'Test',
    colors: [
      { id: 'purple', hex: '#7F39C4' },
      { id: 'red', hex: '#FF0000' },
      { id: 'gray', hex: '#808080' },
      {
        id: 'gradient',
        type: 'gradient',
        gradientType: 'linear',
        direction: 'right',
        stops: [
          { hex: '#000000', position: 0 },
          { hex: '#FFFFFF', position: 100 },
        ],
      },
    ],
  };
  const stored = { language: 'en', colorFormat: 'rgb', currentPalette: structuredClone( initial ) };
  const listeners = new Set();
  let writes = 0;
  let failWrite = false;
  let failCopy = false;
  const copied = [];
  const local = {
    async get( key ) {
      return { [key]: structuredClone( stored[key] ) };
    },
    async set( values ) {
      if ( failWrite ) {
        failWrite = false;
        throw new Error( 'Write failed' );
      }
      if ( values.currentPalette ) writes++;
      Object.assign( stored, structuredClone( values ) );
      const changes = Object.fromEntries(
        Object.entries( values ).map( ( [key, value] ) => [key, { newValue: value }] )
      );
      for ( const listener of listeners ) listener( changes, 'local' );
    },
  };
  const execute = createPaletteExecutor( local );
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    chrome: {
      runtime: {
        id: 'test',
        async sendMessage( message ) {
          try {
            return { ok: true, value: await execute( message ) };
          } catch ( error ) {
            return { ok: false, error: error.code || 'storageFailure' };
          }
        },
      },
      storage: {
        local,
        onChanged: {
          addListener( listener ) {
            listeners.add( listener );
          },
          removeListener( listener ) {
            listeners.delete( listener );
          },
        },
      },
    },
  };
  const originals = new Map();
  for ( const [key, value] of Object.entries( globals ) ) {
    originals.set( key, Object.getOwnPropertyDescriptor( globalThis, key ) );
    Object.defineProperty( globalThis, key, { configurable: true, writable: true, value } );
  }
  Object.defineProperty( navigator, 'clipboard', {
    value: {
      async writeText( value ) {
        if ( failCopy ) throw new Error( 'Clipboard unavailable' );
        copied.push( value );
      },
    },
  } );
  let server;
  let root;
  const click = async ( element ) => {
    assert.ok( element );
    await act( async () => element.click() );
  };
  const category = async ( value ) => {
    await act( async () => {
      const select = document.querySelector( '.advisor-category select' );
      select.value = value;
      select.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
    } );
  };
  try {
    server = await createServer( {
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'custom',
    } );
    const { default: PaletteView } = await server.ssrLoadModule( '/src/components/PaletteView.jsx' );
    const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' );
    await languageReady;
    for ( const editor of [false, true] ) {
      stored.currentPalette = structuredClone( initial );
      writes = 0;
      root = createRoot( document.getElementById( 'root' ) );
      await act( async () => root.render( createElement( PaletteView, { editor } ) ) );
      assert.equal(
        document.querySelectorAll( '.advisor-toggle' ).length,
        3,
        'Gradients have no advisor button'
      );
      await click( document.querySelector( '.advisor-toggle' ) );
      assert.equal( document.querySelectorAll( '.color-advisor' ).length, 1 );
      assert.equal( document.querySelector( '.advisor-source code' ).textContent, '#7F39C4' );
      await click( document.querySelector( '.suggestion-option' ) );
      await category( 'analogous' );
      assert.equal( document.querySelectorAll( '.suggestion-option' ).length, 3 );
      await category( 'accents' );
      assert.equal( document.querySelectorAll( '.color-suggestions' ).length, 2 );
      assert.equal( document.querySelectorAll( '.suggestion-option' ).length, 3 );
      await click( document.querySelector( '.suggestion-option' ) );
      const selected = document.querySelectorAll( '.comparison-pair code' )[1].textContent;
      const originalBackground =
        document.querySelector( '.comparison-composition' ).style.backgroundColor;
      await click( document.querySelector( '.color-comparison > button' ) );
      assert.notEqual(
        document.querySelector( '.comparison-composition' ).style.backgroundColor,
        originalBackground
      );
      await click( document.querySelector( '.advisor-actions button:last-child' ) );
      assert.equal( copied.at( -1 ), colorValues( selected ).rgb );
      assert.equal( writes, 0 );
      assert.deepEqual( stored.currentPalette, initial );
      failCopy = true;
      await click( document.querySelector( '.advisor-actions button:last-child' ) );
      assert.ok( document.querySelector( '.advisor-notice .error' ) );
      failCopy = false;
      failWrite = true;
      await click( document.querySelector( '.advisor-actions .primary' ) );
      assert.equal( writes, 0 );
      assert.ok( document.querySelector( '.advisor-notice .error' ) );
      const addButton = document.querySelector( '.advisor-actions .primary' );
      await act( async () => {
        addButton.click();
        addButton.click();
      } );
      assert.equal( writes, 1 );
      assert.equal( stored.currentPalette.colors.length, initial.colors.length + 1 );
      assert.equal( document.querySelector( '.advisor-source code' ).textContent, '#7F39C4' );
      assert.ok( document.querySelector( '.advisor-actions .primary' ).disabled );
      assert.equal(
        document.querySelector( '.advisor-actions .primary' ).textContent,
        'Already added'
      );
      await click( document.querySelector( '.advisor-actions .primary' ) );
      assert.equal( writes, 1 );
      await click( document.querySelector( '.advisor-heading button' ) );
      assert.equal( document.querySelectorAll( '.color-advisor' ).length, 0 );
      assert.equal( document.activeElement, document.querySelector( '.advisor-toggle' ) );
      assert.equal( writes, 1 );
      await click( document.querySelectorAll( '.advisor-toggle' )[0] );
      await click( document.querySelectorAll( '.advisor-toggle' )[1] );
      assert.equal( document.querySelectorAll( '.color-advisor' ).length, 1 );
      assert.equal( document.querySelector( '.advisor-source code' ).textContent, '#FF0000' );
      await click( document.querySelectorAll( '.advisor-toggle' )[2] );
      assert.equal( document.querySelector( '.advisor-source code' ).textContent, '#808080' );
      assert.equal( document.querySelectorAll( '.advisor-category option:disabled' ).length, 2 );
      assert.equal( writes, 1 );
      // Deletion from another context closes the removed source's advisor.
      await act( async () =>
        local.set( {
          currentPalette: {
            ...stored.currentPalette,
            colors: stored.currentPalette.colors.filter( ( item ) => item.id !== 'gray' ),
          },
        } )
      );
      assert.equal( document.querySelectorAll( '.color-advisor' ).length, 0 );
      await act( async () => root.unmount() );
      root = null;
    }
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
