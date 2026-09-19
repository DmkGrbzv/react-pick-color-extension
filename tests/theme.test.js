import test from 'node:test';
import assert from 'node:assert/strict';
import { ThemePreference } from '@/preferences/themePreference.js';
import { THEMES } from '@/constants/themes.js';

function fakeStorage( initial = {} ) {
  const data = structuredClone( initial );
  const listeners = new Set();
  return {
    data,
    local: {
      async get( key ) {
        return { [key]: data[key] };
      },
      async set( values ) {
        Object.assign( data, values );
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
    get listenerCount() {
      return listeners.size;
    },
  };
}

test( 'theme persists independently of palette and broadcasts to other views', async () => {
  const palette = { id: 'current', name: 'Big dq', colors: [{ id: '1', hex: '#00897B' }] };
  const api = fakeStorage( { currentPalette: palette, language: 'uk', colorFormat: 'rgb' } );
  const panel = new ThemePreference( api );
  const editor = new ThemePreference( api );
  const received = [];
  const unsubscribe = editor.subscribe( ( value ) => received.push( value ) );
  assert.equal( await panel.read(), THEMES.LIGHT );
  await panel.save( THEMES.DARK );
  assert.deepEqual( received, [THEMES.DARK] );
  assert.equal( await new ThemePreference( api ).read(), THEMES.DARK );
  assert.deepEqual( api.data, {
    currentPalette: palette,
    language: 'uk',
    colorFormat: 'rgb',
    theme: THEMES.DARK,
  } );
  unsubscribe();
  assert.equal( api.listenerCount, 0 );
} );

test( 'missing and invalid themes fall back to light; invalid writes and storage failures propagate', async () => {
  const api = fakeStorage( { theme: 'invalid' } );
  const preference = new ThemePreference( api );
  assert.equal( await preference.read(), THEMES.LIGHT );
  await assert.rejects( preference.save( 'system' ), /Unsupported theme/ );
  const error = new Error( 'Storage unavailable' );
  api.local.set = async () => {
    throw error;
  };
  await assert.rejects( preference.save( THEMES.DARK ), ( received ) => received === error );
  assert.equal( api.data.theme, 'invalid' );
  api.local.get = async () => {
    throw error;
  };
  await assert.rejects( preference.read(), ( received ) => received === error );
} );
