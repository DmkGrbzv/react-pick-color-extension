import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

test( 'panel and editor copy the selected format after changing and reopening the view', async () => {
  const dom = new JSDOM( '<div id="root"></div>', { url: 'https://extension.test/editor.html' } );
  const listeners = new Set();
  const stored = { language: 'en', colorFormat: 'hex' };
  const copied = [];
  const palette = { id: 'current', name: 'Palette', colors: [{ id: 'color', hex: '#CFA5B4' }] };
  const originals = new Map();
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    chrome: {
      runtime: {
        id: 'test',
        async sendMessage() {
          return { ok: true, value: palette };
        },
      },
      storage: {
        local: {
          async get( key ) {
            return { [key]: stored[key] };
          },
          async set( values ) {
            Object.assign( stored, values );
            const changes = Object.fromEntries(
              Object.entries( values ).map( ( [key, value] ) => [key, { newValue: value }] )
            );
            for ( const listener of listeners ) listener( changes, 'local' );
          },
        },
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
  for ( const [key, value] of Object.entries( globals ) ) {
    originals.set( key, Object.getOwnPropertyDescriptor( globalThis, key ) );
    Object.defineProperty( globalThis, key, { configurable: true, writable: true, value } );
  }
  Object.defineProperty( navigator, 'clipboard', {
    value: {
      async writeText( value ) {
        copied.push( value );
      },
    },
  } );
  let server;
  let root;
  try {
    server = await createServer( {
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'custom',
    } );
    const { default: PaletteView } = await server.ssrLoadModule( '/src/components/PaletteView.jsx' );
    const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' );
    await languageReady;
    for ( const editor of [false, true] ) {
      root = createRoot( document.getElementById( 'root' ) );
      await act( async () => {
        root.render( createElement( PaletteView, { editor } ) );
      } );
      const selector = document.querySelector( '.format-control select' );
      assert.equal( selector.value, stored.colorFormat );
      const cases = [
        ['rgb', '207, 165, 180'],
        ['cmyk', '0%, 20%, 13%, 19%'],
        ['hex', '#CFA5B4'],
        ['rgb', '207, 165, 180'],
      ];
      for ( const [format, expected] of cases ) {
        await act( async () => {
          selector.value = format;
          selector.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
        } );
        assert.equal( stored.colorFormat, format );
        assert.equal(
          document.querySelector( '.color-card .primary-value dt' ).textContent,
          format.toUpperCase()
        );
        await act( async () => {
          document.querySelector( '.color-card .color-actions button' ).click();
        } );
        assert.equal( copied.at( -1 ), expected );
        assert.ok( document.querySelector( '.notice' ).textContent.includes( expected ) );
      }
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
