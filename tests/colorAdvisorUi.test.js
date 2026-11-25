import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPaletteExecutor } from './helpers/palette.js';
import { findHistoricalPalettes } from '@/features/color-advisor/utils/historicalPalettes.js';
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
    const { default: App } = await server.ssrLoadModule( '/src/App.jsx' );
    const { languageReady, default: i18n } = await server.ssrLoadModule( '/src/i18n/index.js' );
    await languageReady;
    for ( const editor of [false, true] ) {
      stored.currentPalette = structuredClone( initial );
      writes = 0;
      root = createRoot( document.getElementById( 'root' ) );
      await act( async () => root.render( createElement( App, { panel: !editor } ) ) );
      assert.equal(
        document.querySelectorAll( '.advisor-toggle' ).length,
        3,
        'Gradients have no advisor button'
      );
      const sourceToggle = document.querySelector( '.advisor-toggle' );
      await click( sourceToggle );
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
      assert.equal( stored.currentPalette.colors[0].hex, selected );
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
      assert.equal( document.activeElement, sourceToggle );
      assert.equal( writes, 1 );
      await click( sourceToggle );
      await click( document.querySelectorAll( '.advisor-toggle' )[2] );
      assert.equal( document.querySelectorAll( '.color-advisor' ).length, 1 );
      assert.equal( document.querySelector( '.advisor-source code' ).textContent, '#FF0000' );
      await click( document.querySelectorAll( '.advisor-toggle' )[3] );
      assert.equal( document.querySelector( '.advisor-source code' ).textContent, '#808080' );
      assert.equal( document.querySelectorAll( '.advisor-category option:disabled' ).length, 2 );
      assert.equal( writes, 1 );
      await category( 'historical' );
      assert.equal( document.querySelectorAll( '.historical-palette' ).length, 6 );
      assert.equal( document.querySelector( '.historical-palettes > label select' ).value, 'original' );
      const expectedId = findHistoricalPalettes( '#808080' )[0].id;
      for ( const labels of [
        { lang: 'en', title: 'Find color combinations', classic: 'Classic', personal: 'With my color',
          your: 'Your color', nearest: 'Closest color in the collection', card: 'Palette No. ',
          classicHint: 'Original combinations from the collection, found using the closest shade to your color.',
          personalHint: 'Combinations from the collection with one shade replaced by your selected color.' },
        { lang: 'uk', title: 'Добір кольорових поєднань', classic: 'Класичні', personal: 'З моїм кольором',
          your: 'Ваш колір', nearest: 'Найближчий колір у колекції', card: 'Палітра №',
          classicHint: 'Оригінальні поєднання з колекції, знайдені за найближчим відтінком до вашого кольору.',
          personalHint: 'Поєднання з колекції, у яких один із відтінків замінено на ваш вибраний колір.' },
      ] ) {
        await act( async () => i18n.changeLanguage( labels.lang ) );
        const selector = document.querySelector( '.historical-palettes > label select' );
        const card = document.querySelector( '.historical-palette' );
        assert.equal( document.querySelector( '.advisor-heading h3' ).textContent, labels.title );
        assert.deepEqual( [...selector.options].map( option => option.textContent ), [labels.classic, labels.personal] );
        const explanation = document.getElementById( selector.getAttribute( 'aria-describedby' ) );
        assert.equal( explanation.textContent, labels.classicHint );
        assert.ok( document.querySelector( '.advisor-source' ).textContent.includes( labels.your ) );
        assert.equal( card.querySelector( 'h4' ).textContent, labels.card + expectedId );
        assert.equal( card.getAttribute( 'aria-label' ), labels.card + expectedId );
        assert.equal( card.querySelectorAll( '.suggestion-label' ).length, 0 );
        assert.ok( [...card.querySelectorAll( '.suggestion-option' )].some( node => node.getAttribute( 'aria-label' ).includes( labels.nearest ) ) );
        const historicalHexes = [...card.querySelectorAll( '.suggestion-option' )].map( node => node.querySelectorAll( 'span' )[1].textContent );
        await act( async () => {
          selector.value = 'adapted';
          selector.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
        } );
        assert.equal( explanation.textContent, labels.personalHint );
        const marker = [...card.querySelectorAll( '.suggestion-option' )].find( node => node.getAttribute( 'aria-label' ).includes( labels.your ) );
        assert.equal( marker.querySelectorAll( 'span' )[1].textContent, '#808080' );
        assert.ok( !card.textContent.includes( labels.your ) );
        assert.ok( !card.textContent.includes( labels.nearest ) );
        assert.equal( marker.querySelectorAll( '.suggestion-saved' ).length, 1 );
        assert.equal( marker.querySelector( '.suggestion-saved' ).textContent, labels.lang === 'uk' ? 'Вже додано' : 'Already added' );
        for ( const option of card.querySelectorAll( '.suggestion-option' ) ) {
          const value = option.querySelectorAll( 'span' )[1].textContent;
          const exists = stored.currentPalette.colors.some( item => item.hex === value );
          assert.equal( option.querySelectorAll( '.suggestion-saved' ).length, exists ? 1 : 0 );
        }
        await act( async () => {
          selector.value = 'original';
          selector.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
        } );
        assert.equal( explanation.textContent, labels.classicHint );
        assert.deepEqual( [...card.querySelectorAll( '.suggestion-option' )].map( node => node.querySelectorAll( 'span' )[1].textContent ), historicalHexes );
      }
      await act( async () => i18n.changeLanguage( 'en' ) );
      const originalHexes = [...document.querySelectorAll( '.historical-palette:first-of-type .suggestion-option' )].map( node => node.querySelectorAll( 'span' )[1].textContent );
      const beforeHistorical = structuredClone( stored.currentPalette );
      await act( async () => {
        const select = document.querySelector( '.historical-palettes > label select' );
        select.value = 'adapted';
        select.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
      } );
      const firstCard = document.querySelector( '.historical-palette' );
      const adaptedHexes = [...firstCard.querySelectorAll( '.suggestion-option' )].map( node => node.querySelectorAll( 'span' )[1].textContent );
      assert.ok( adaptedHexes.includes( '#808080' ) );
      assert.equal( adaptedHexes.length, originalHexes.length );
      assert.deepEqual( stored.currentPalette, beforeHistorical );
      await click( firstCard.querySelector( '.suggestion-option' ) );
      await click( document.querySelector( '.advisor-actions button:last-child' ) );
      assert.equal( copied.at( -1 ), adaptedHexes[0] );
      failWrite = true;
      await click( firstCard.querySelector( ':scope > button' ) );
      assert.equal( writes, 1 );
      assert.deepEqual( stored.currentPalette, beforeHistorical );
      assert.ok( document.querySelector( '.advisor-notice .error' ) );
      const addAll = firstCard.querySelector( ':scope > button' );
      await act( async () => { addAll.click(); addAll.click(); } );
      assert.equal( writes, 2, 'one complete batch write despite rapid clicks' );
      assert.ok( firstCard.querySelector( ':scope > button' ).disabled );
      const expectedNew = adaptedHexes.filter( hex => !beforeHistorical.colors.some( item => item.hex === hex ) );
      assert.deepEqual( stored.currentPalette.colors.slice( 0, expectedNew.length ).map( item => item.hex ), expectedNew );
      assert.deepEqual( stored.currentPalette.colors.slice( expectedNew.length ), beforeHistorical.colors );
      const beforeRemoteDelete = structuredClone( stored.currentPalette );
      const removedHex = expectedNew[0];
      assert.ok( removedHex );
      const swatchFor = hex => [...firstCard.querySelectorAll( '.suggestion-option' )].find( node => node.querySelectorAll( 'span' )[1].textContent === hex );
      await act( async () => local.set( { currentPalette: {
        ...beforeRemoteDelete, colors: beforeRemoteDelete.colors.filter( item => item.hex !== removedHex ),
      } } ) );
      assert.equal( swatchFor( removedHex ).querySelector( '.suggestion-saved' ), null );
      await act( async () => local.set( { currentPalette: beforeRemoteDelete } ) );
      assert.equal( swatchFor( removedHex ).querySelectorAll( '.suggestion-saved' ).length, 1 );
      await act( async () => {
        const select = document.querySelector( '.historical-palettes > label select' );
        select.value = 'original';
        select.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
      } );
      assert.deepEqual( [...firstCard.querySelectorAll( '.suggestion-option' )].map( node => node.querySelectorAll( 'span' )[1].textContent ), originalHexes );
      assert.equal( document.querySelector( '.advisor-actions' ), null );
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
