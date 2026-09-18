import { ERROR_CODES } from '@/constants/errorCodes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInstance } from 'i18next';
import { LanguagePreference, resolveLanguage, SUPPORTED_LANGUAGES } from '@/i18n/language.js';
import { AppError, errorKey } from '@/errors.js';

const readJson = ( path ) => JSON.parse( readFileSync( new URL( path, import.meta.url ), 'utf8' ) );
const uk = readJson( '../src/i18n/locales/uk.json' );
const en = readJson( '../src/i18n/locales/en.json' );

function flatten( value, prefix = '' ) {
  return Object.entries( value ).flatMap( ( [key, child] ) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [[path, child]] : flatten( child, path );
  } );
}

test( 'only Ukrainian and English are supported; regional locales normalize correctly', () => {
  assert.deepEqual( SUPPORTED_LANGUAGES, ['uk', 'en'] );
  assert.equal( resolveLanguage( 'uk-UA' ), 'uk' );
  assert.equal( resolveLanguage( 'en-US' ), 'en' );
  assert.equal( resolveLanguage( 'EN_gb' ), 'en' );
  for ( const locale of ['ru', 'de', '', undefined, false] )
    assert.equal( resolveLanguage( locale ), 'uk' );
} );

test( 'both dictionaries contain the same keys and interpolation parameters', () => {
  const first = Object.fromEntries( flatten( uk ) );
  const second = Object.fromEntries( flatten( en ) );
  assert.deepEqual( Object.keys( first ).sort(), Object.keys( second ).sort() );
  for ( const key of Object.keys( first ) ) {
    assert.ok( first[key].trim() && second[key].trim(), key );
    assert.deepEqual( first[key].match( /{{[^}]+}}/g ), second[key].match( /{{[^}]+}}/g ), key );
    assert.doesNotMatch( first[key], /[ыэъёЫЭЪЁ\uFFFD]/, key );
  }
} );

test( 'language changes retranslate existing notification and error keys', async () => {
  const i18n = createInstance();
  await i18n.init( {
    resources: { uk: { translation: uk }, en: { translation: en } },
    lng: 'uk',
    fallbackLng: 'uk',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
  } );
  const notice = { key: 'colorCopied', values: { hex: '#AABBCC' } };
  assert.equal( i18n.t( notice.key, notice.values ), '#AABBCC скопійовано.' );
  assert.equal(
    i18n.t( errorKey( new AppError( 'invalidPalette' ), 'storageFailure' ) ),
    uk.errors.invalidPalette
  );
  await i18n.changeLanguage( 'en' );
  assert.equal( i18n.t( notice.key, notice.values ), '#AABBCC copied.' );
  assert.equal(
    i18n.t( errorKey( new AppError( 'invalidPalette' ), 'storageFailure' ) ),
    en.errors.invalidPalette
  );
  assert.equal( errorKey( new Error( 'Untranslated system error' ), 'copyFailed' ), 'errors.copyFailed' );
} );

function fakeStorage( initial = {} ) {
  let data = structuredClone( initial );
  const listeners = new Set();
  let fail = false;
  return {
    local: {
      async get() {
        return structuredClone( data );
      },
      async set( update ) {
        if ( fail ) {
          fail = false;
          throw new Error( 'Write failed' );
        }
        const changes = {};
        for ( const [key, value] of Object.entries( update ) ) changes[key] = { newValue: value };
        data = { ...data, ...update };
        listeners.forEach( ( listener ) => listener( changes, 'local' ) );
      },
    },
    onChanged: {
      addListener: ( listener ) => listeners.add( listener ),
      removeListener: ( listener ) => listeners.delete( listener ),
    },
    failNextWrite() {
      fail = true;
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

test( 'panel and editor synchronize language, persist it across reopen, and preserve palette', async () => {
  const palette = { id: 'current', name: 'My palette', colors: [{ id: '1', hex: '#123456' }] };
  const api = fakeStorage( { currentPalette: palette } );
  let panelLanguage;
  let editorLanguage;
  const panel = new LanguagePreference( api, 'uk', ( value ) => {
    panelLanguage = value;
  } );
  const editor = new LanguagePreference( api, 'uk', ( value ) => {
    editorLanguage = value;
  } );
  await Promise.all( [panel.start(), editor.start()] );
  assert.equal( panelLanguage, 'uk' );
  await panel.set( 'en' );
  assert.equal( panelLanguage, 'en' );
  assert.equal( editorLanguage, 'en' );
  await editor.set( 'uk' );
  assert.equal( panelLanguage, 'uk' );
  assert.equal( editorLanguage, 'uk' );
  await editor.set( 'en' );
  panel.stop();
  editor.stop();
  assert.equal( api.listenerCount, 0 );
  const reopened = new LanguagePreference( api, 'uk', ( value ) => {
    panelLanguage = value;
  } );
  await reopened.start();
  assert.equal( panelLanguage, 'en' );
  assert.deepEqual( ( await api.local.get() ).currentPalette, palette );
  reopened.stop();
} );

test( 'late initial storage response does not overwrite a newer language event', async () => {
  const api = fakeStorage();
  let releaseRead;
  api.local.get = () =>
    new Promise( ( resolve ) => {
      releaseRead = resolve;
    } );
  let language;
  const preference = new LanguagePreference( api, 'uk', ( value ) => {
    language = value;
  } );
  const starting = preference.start();
  await api.local.set( { language: 'en' } );
  releaseRead( { language: 'uk' } );
  await starting;
  assert.equal( language, 'en' );
  preference.stop();
} );

test( 'failed writes keep the language; retry works and unsupported choices are rejected', async () => {
  const api = fakeStorage( { language: 'uk' } );
  let language;
  const preference = new LanguagePreference( api, 'en', ( value ) => {
    language = value;
  } );
  await preference.start();
  api.failNextWrite();
  await assert.rejects( preference.set( 'en' ), /Write failed/ );
  assert.equal( language, 'uk' );
  await preference.set( 'en' );
  assert.equal( language, 'en' );
  await assert.rejects( preference.set( 'ru' ), /Unsupported/ );
  assert.equal( language, 'en' );
  preference.stop();
} );

test( 'unsupported saved language falls back to Ukrainian', async () => {
  const api = fakeStorage( { language: 'ru' } );
  let language;
  const preference = new LanguagePreference( api, 'en', ( value ) => {
    language = value;
  } );
  await preference.start();
  assert.equal( language, 'uk' );
  preference.stop();
} );

test( 'manifest translations exist for both supported languages', () => {
  const manifest = readJson( '../public/manifest.json' );
  assert.equal( manifest.default_locale, 'uk' );
  for ( const language of SUPPORTED_LANGUAGES ) {
    const messages = readJson( `../public/_locales/${language}/messages.json` );
    for ( const value of [manifest.name, manifest.description, manifest.action.default_title] ) {
      const key = value.match( /^__MSG_(.+)__$/ )[1];
      assert.ok( messages[key].message );
    }
  }
} );

test( 'every shared error code has Ukrainian and English translations', () => {
  const codes = Object.values( ERROR_CODES );
  assert.equal( new Set( codes ).size, codes.length );
  assert.deepEqual( [...codes].sort(), Object.keys( en.errors ).sort() );
  for ( const code of codes ) {
    assert.ok( uk.errors[code]?.trim(), code );
    assert.ok( en.errors[code]?.trim(), code );
    assert.equal( errorKey( new Error(), code ), 'errors.' + code );
  }
} );
