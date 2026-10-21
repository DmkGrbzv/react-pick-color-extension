import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createTestStorage } from './helpers/extensionStorage.js';

test( 'library UI allows independent login, preserves full mixed sets and requires explicit save confirmation', async () => {
  const dom = new JSDOM( '<div id="root"></div>', { url: 'https://extension.test/editor.html' } );
  const storage = createTestStorage();
  storage.local.data.language = 'en';
  const gradient = { type: 'gradient', gradientType: 'linear', direction: 'right',
    stops: [{ hex: '#112233', position: 0 }, { hex: '#FFFFFF', position: 100 }] };
  const items = [{ type: 'color', hex: '#AABBCC' }, gradient,
    ...['#FF0000', '#00FF00', '#0000FF', '#000000'].map( ( hex ) => ( { type: 'color', hex } ) )];
  const set = { id: 'set-1', name: 'Mixed set', items, createdAt: new Date().toISOString() };
  let account = null;
  let pending = null;
  let saves = 0;
  let logins = 0;
  let deletes = 0;
  let listOffline = true;
  let working = { id: 'current', name: 'Working', colors: [{ id: 'one', hex: '#AABBCC' }] };
  let opens = 0;
  const fullRequests = [];
  let confirmDelete = false;
  dom.window.confirm = () => confirmDelete;
  const originals = new Map();
  const state = () => ( { configured: true, sessionId: account ? 'session' : null, user: account, pending } );
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    chrome: { storage, windows: { getCurrent: async () => ( { id: 1 } ) }, runtime: { id: 'test', async sendMessage( message ) {
      switch ( message.type ) {
        case 'palette:get': return { ok: true, value: working };
        case 'editor:open': fullRequests.push( message ); return { ok: true, value: 100 };
        case 'cloud:open': {
          opens++;
          working = { id: 'current', name: set.name, colors: [{ id: 'opened', hex: '#000000' }] };
          await storage.local.set( { currentPalette: working } );
          return { ok: true, value: working };
        }
        case 'cloud:state': return { ok: true, value: state() };
        case 'cloud:signIn':
          logins++;
          account = { id: 'A', email: 'a@example.test', expiresAt: new Date( Date.now() + 60_000 ).toISOString() };
          return { ok: true, value: state() };
        case 'cloud:list':
          if ( listOffline ) return { ok: false, error: 'cloudFailed' };
          return { ok: true, value: { palettes: deletes ? [] : [set], nextCursor: null } };
        case 'cloud:get': return { ok: true, value: set };
        case 'cloud:prepare': pending = { key: 'key', snapshot: { name: 'Working', items } }; return { ok: true, value: state() };
        case 'cloud:nameSave': pending.snapshot.name = message.name; return { ok: true, value: state() };
        case 'cloud:save': saves++; pending = null; return { ok: true, value: set };
        case 'cloud:cancelSave': pending = null; return { ok: true, value: state() };
        case 'cloud:remove': deletes++; return { ok: true, value: null };
        default: throw new Error( 'Unexpected message: ' + message.type );
      }
    } } },
  };
  for ( const [key, value] of Object.entries( globals ) ) {
    originals.set( key, Object.getOwnPropertyDescriptor( globalThis, key ) );
    Object.defineProperty( globalThis, key, { configurable: true, writable: true, value } );
  }
  let server;
  let root;
  const button = ( label ) => [...document.querySelectorAll( 'button' )].find( ( item ) => item.textContent === label );
  const click = async ( label ) => {
    const target = button( label );
    assert.ok( target, label );
    await act( async () => { target.click(); } );
  };
  try {
    server = await createServer( {
      server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
    } );
    const { default: App } = await server.ssrLoadModule( '/src/App.jsx' );
    const { snapshotSignature } = await server.ssrLoadModule( '/src/utils/paletteSnapshot.js' );
    const { languageReady } = await server.ssrLoadModule( '/src/i18n/index.js' );
    await languageReady;
    const palette = { id: 'current', name: 'Working', colors: [{ id: 'one', hex: '#AABBCC' }] };
    root = createRoot( document.getElementById( 'root' ) );
    await act( async () => root.render( createElement( App, { initialPage: 'library' } ) ) );
    assert.equal( button( 'Retry loading palettes' ), undefined );
    assert.equal( document.querySelector( 'nav a[aria-current="page"]' ).textContent, 'Saved palettes' );
    await act( async () => document.querySelector( '.app-account summary' ).click() );
    await click( 'Sign in with Google' );
    assert.equal( logins, 1 );
    assert.equal( saves, 0 );
    assert.ok( button( 'Retry loading palettes' ) );
    listOffline = false;
    await click( 'Retry loading palettes' );
    assert.equal( button( 'Retry loading palettes' ), undefined );
    assert.equal( document.querySelectorAll( '.saved-library > li' ).length, 1 );
    assert.equal( document.querySelector( '.saved-extra' ).textContent, '+1' );
    await click( 'Details' );
    assert.equal( document.querySelectorAll( '.saved-detail-items > li' ).length, 6 );
    assert.ok( document.querySelector( '.saved-detail-items' ).textContent.includes( 'linear-gradient' ) );
    await click( 'Save palette' );
    assert.equal( saves, 0 );
    assert.ok( document.querySelector( '.saved-confirm' ) );
    assert.equal( document.querySelector( '.saved-confirm input' ).value, 'Working' );
    await click( 'Cancel save' );
    assert.equal( saves, 0 );
    await click( 'Save palette' );
    await click( 'Confirm save' );
    assert.equal( saves, 1 );
    assert.equal( palette.colors.length, 1 );
    const savedWorking = { ...palette, cloudSource: { id: set.id, ownerId: 'A', signature: snapshotSignature( palette ) } };
    working = savedWorking;
    await act( async () => storage.local.set( { currentPalette: working } ) );
    assert.equal( button( 'Save palette' ).disabled, true );
    const edited = { ...savedWorking, colors: [...savedWorking.colors, { id: 'new', hex: '#FF0000' }] };
    working = edited;
    await act( async () => storage.local.set( { currentPalette: working } ) );
    assert.equal( button( 'Save palette' ).disabled, false );
    await click( 'Delete palette' );
    assert.equal( deletes, 0 );
    assert.equal( document.querySelectorAll( '.saved-library > li' ).length, 1 );
    confirmDelete = true;
    await click( 'Delete palette' );
    assert.equal( deletes, 1 );
    assert.equal( document.querySelectorAll( '.saved-library > li' ).length, 0 );
    assert.equal( document.querySelector( '.saved-details' ), null );
    assert.equal( palette.colors.length, 1 );
    deletes = 0;
    await act( async () => root.render( createElement( App, { initialPage: 'library', key: 'reopened' } ) ) );
    assert.equal( document.title, 'Palettes and account' );
    assert.ok( document.body.textContent.includes( 'Working palette: Working' ) );
    const stableNavigation = document.querySelector( 'nav' );
    const stableHeader = document.querySelector( '.app-header' );
    await click( 'Open as working palette' );
    assert.equal( opens, 1 );
    assert.equal( document.querySelector( 'h1' ).textContent, 'Mixed set' );
    assert.equal( document.querySelector( 'nav' ), stableNavigation );
    assert.equal( document.querySelector( '.app-header' ), stableHeader );
    assert.equal( document.querySelector( 'nav [aria-current="page"]' ).textContent, 'Working palette' );
    await act( async () => root.render( createElement( App, { panel: false, key: 'editor' } ) ) );
    assert.equal( document.querySelector( '.saved-palettes' ), null );
    assert.equal( document.querySelector( '.app-account' ).open, false );
    assert.equal( document.querySelector( 'h1' ).textContent, 'Mixed set' );
    const libraryLink = document.querySelector( '.app-navigation a[href="editor.html#view=library"]' );
    assert.equal( libraryLink?.getAttribute( 'href' ), 'editor.html#view=library' );
    assert.equal( libraryLink?.hasAttribute( 'target' ), false );
    assert.equal( document.querySelectorAll( 'nav' ).length, 1 );
    assert.equal( document.querySelectorAll( '.app-navigation button.primary' ).length, 1 );
    const currentPath = window.location.pathname;
    const nav = document.querySelector( 'nav' );
    const printLink = () => document.querySelector( 'nav a[href$="view=print"]' );
    const workingLink = () => document.querySelector( 'nav a[href$="view=working"]' );
    await click( 'Create gradient' );
    const gradientForm = document.querySelector( '.gradient-builder' );
    await act( async () => printLink().click() );
    const orientation = document.querySelector( '.print-settings-grid select' );
    await act( async () => {
      orientation.value = 'landscape';
      orientation.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
    } );
    await act( async () => workingLink().click() );
    assert.equal( document.querySelector( '.gradient-builder' ), gradientForm );
    await act( async () => printLink().click() );
    assert.equal( document.querySelector( '.print-settings-grid select' ).value, 'landscape' );
    assert.equal( window.location.pathname, currentPath );
    assert.equal( document.querySelector( 'nav' ), nav );
    await act( async () => {
      window.history.back();
      await new Promise( ( resolve ) => setTimeout( resolve, 25 ) );
    } );
    assert.equal( document.querySelector( 'nav [aria-current="page"]' ).textContent, 'Working palette' );
    await act( async () => root.render( createElement( App, { panel: true, key: 'panel' } ) ) );
    await act( async () => document.querySelector( 'nav a[href$="view=library"]' ).click() );
    assert.ok( document.querySelector( 'main' ).classList.contains( 'panel' ) );
    assert.equal( fullRequests.length, 0 );
    await click( 'Open full view' );
    assert.equal( fullRequests.length, 1 );
    assert.equal( fullRequests[0].view, 'library' );
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
