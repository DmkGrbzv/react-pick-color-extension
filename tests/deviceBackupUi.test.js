import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act } from 'react';
import { createTestStorage, deferred } from './helpers/extensionStorage.js';

test( 'device backup UI is explicit, read-only, offline-capable and hides prior contents on account remount', async () => {
  const dom = new JSDOM( '<div id="root"></div>', { url: 'https://extension.test/editor.html' } );
  const storage = createTestStorage(); storage.local.data.language = 'en';
  const messages = [];
  const backup = { version: 1, createdAt: new Date().toISOString(), count: 5,
    palettes: [{ name: '<script>harmless text</script>', items: [{ type: 'color', hex: '#AABBCC' }] }, ...Array.from( { length: 4 }, ( _, index ) => ( { name: 'Set ' + ( index + 2 ), items: [{ type: 'color', hex: '#AABBCC' }] } ) )] };
  const capture = deferred();
  let copying = '';
  let opened = 0;
  const values = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true, chrome: { storage, runtime: { id: 'test', async sendMessage( message ) {
      messages.push( message );
      if ( message.type === 'backup:create' ) return capture.promise;
      return { ok: true, value: message.type === 'backup:read' ? backup : null };
    } } } };
  const original = new Map();
  for ( const [key, value] of Object.entries( values ) ) {
    original.set( key, Object.getOwnPropertyDescriptor( globalThis, key ) );
    Object.defineProperty( globalThis, key, { configurable: true, writable: true, value } );
  }
  Object.defineProperty( navigator, 'clipboard', { value: { writeText: async ( value ) => { copying = value; } } } );
  window.confirm = () => true;
  const server = await createServer( { server: { middlewareMode: true }, appType: 'custom' } );
  let root;
  const button = ( name ) => [...document.querySelectorAll( 'button' )].find( ( value ) => value.textContent === name );
  const click = ( name ) => act( async () => button( name ).click() );
  try {
    const { createRoot } = await import( 'react-dom/client' );
    const { default: Panel } = await server.ssrLoadModule( '/src/features/saved-palettes/components/DeviceBackupPanel.jsx' );
    const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' ); await languageReady;
    root = createRoot( document.getElementById( 'root' ) );
    const palette = { id: 'current', name: '', colors: [] };
    const render = ( signedIn, key ) => act( async () => root.render( createElement( Panel, { key, signedIn, palette, onOpened: () => { opened++; } } ) ) );
    await render( false, 'guest' );
    assert.equal( messages.length, 0 );
    assert.ok( button( 'Save backup on this device' ).disabled );
    assert.ok( !button( 'Delete device backup' ).disabled );
    await click( 'View device backup' );
    assert.ok( document.body.textContent.includes( '<script>harmless text</script>' ) );
    assert.equal( document.querySelector( 'script' ), null );
    assert.equal( document.querySelectorAll( '.saved-library > li' ).length, 4 );
    await click( '#AABBCC' ); assert.equal( copying, '#AABBCC' );
    await click( 'Open as working palette' ); assert.equal( opened, 1 );
    assert.ok( messages.find( ( message ) => message.type === 'backup:open' ).expectedVersion );
    await click( 'Next backup cards' );
    assert.equal( document.querySelectorAll( '.saved-library > li' ).length, 1 );
    await click( 'Open as working palette' );
    assert.equal( messages.filter( ( message ) => message.type === 'backup:open' ).at( -1 ).index, 4 );
    await act( async () => storage.local.remove( 'devicePaletteBackup' ) );
    assert.equal( document.querySelectorAll( '.saved-library > li' ).length, 0 );
    await render( true, 'accountA' );
    assert.ok( !document.body.textContent.includes( 'harmless text' ) );
    await click( 'Save backup on this device' );
    await click( 'Save backup on this device' );
    assert.equal( messages.filter( ( message ) => message.type === 'backup:create' ).length, 1 );
    await render( true, 'accountB' );
    await act( async () => capture.resolve( { ok: true, value: { count: 1 } } ) );
    assert.ok( !document.body.textContent.includes( 'Device backup saved.' ) );
    await render( false, 'guestAgain' );
    await click( 'Delete device backup' );
    assert.ok( messages.some( ( message ) => message.type === 'backup:remove' ) );
    assert.ok( !messages.some( ( message ) => message.type.startsWith( 'cloud:' ) ) );
  } finally {
    if ( root ) await act( async () => root.unmount() );
    await server.close(); dom.window.close();
    for ( const [key, descriptor] of original ) {
      if ( descriptor ) Object.defineProperty( globalThis, key, descriptor ); else delete globalThis[key];
    }
  }
} );
