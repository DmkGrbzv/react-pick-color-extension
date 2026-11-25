import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import data from '../src/features/color-advisor/data/sanzoWada.json' with { type: 'json' };
import { buildHistoricalPalettes, findHistoricalPalettes, hexToLab } from '@/features/color-advisor/utils/historicalPalettes.js';

const palettes = buildHistoricalPalettes( data );

test( 'pinned dataset has 159 colors, all 348 valid references and original HEX values', async () => {
  const notices = await readFile( new URL( '../public/THIRD-PARTY-NOTICES.txt', import.meta.url ), 'utf8' );
  assert.ok( notices.includes( 'Copyright (c) 2020 Matt DesLauriers' ) );
  assert.ok( notices.includes( 'Copyright (c) 2024 Dain Blodorn' ) );
  assert.ok( notices.includes( 'c142bd0bc8049ea48db4da5eb397981f047e8ef4' ) );
  assert.equal( data.length, 159 );
  assert.equal( palettes.length, 348 );
  assert.deepEqual( palettes.map( item => item.id ), Array.from( { length: 348 }, ( _, i ) => i + 1 ) );
  const bytes = JSON.stringify( JSON.parse( await readFile( new URL( '../src/features/color-advisor/data/sanzoWada.json', import.meta.url ), 'utf8' ) ) );
  assert.equal( createHash( 'sha256' ).update( bytes ).digest( 'hex' ), 'a24e7b0101c5f1e7eed104d84b27a7c9bba147017589302d78c2992c37c2d853' );
  for ( const palette of palettes ) {
    assert.ok( palette.colors.length >= 2 && palette.colors.length <= 4 );
    assert.deepEqual( palette.colors, data.filter( color => color.combinations.includes( palette.id ) ).map( color => color.hex.toUpperCase() ) );
  }
  for ( const mutate of [
    value => value.pop(), value => { value[0] = null; },
    value => { value[0].hex = 'red'; }, value => { value[0].hex = value[1].hex; },
    value => { value[0].combinations.push( 349 ); }, value => { value[0].combinations.push( value[0].combinations[0] ); },
    value => { for ( const color of value ) color.combinations = color.combinations.filter( id => id !== 1 ); },
    value => { for ( const color of value ) if ( !color.combinations.includes( 1 ) ) color.combinations.push( 1 ); },
  ] ) {
    const copy = structuredClone( data );
    mutate( copy );
    assert.throws( () => buildHistoricalPalettes( copy ) );
  }
} );

test( 'CIELAB matches reference black, D65 white and sRGB red', () => {
  for ( const [hex, expected] of [['#000000', [0, 0, 0]], ['#FFFFFF', [100, 0, 0]], ['#FF0000', [53.24, 80.09, 67.2]]] ) {
    hexToLab( hex ).forEach( ( channel, i ) => assert.ok( Math.abs( channel - expected[i] ) < 0.02 ) );
  }
} );

test( 'ranking is deterministic, perceptual and stable for neutral and exact historical colors', () => {
  for ( const hex of ['#000000', '#FFFFFF', '#808080', '#f9c1ce', '#123456'] ) {
    const result = findHistoricalPalettes( hex, 20 );
    assert.deepEqual( result, findHistoricalPalettes( hex.toUpperCase(), 20 ) );
    assert.equal( result.length, 20 );
    assert.equal( new Set( result.map( item => [...item.original].sort().join( ',' ) ) ).size, result.length );
    const lab = hexToLab( hex );
    const expected = palettes.map( palette => ( { id: palette.id, distance: Math.min( ...palette.labs.map( value => Math.hypot( ...value.map( ( v, i ) => v - lab[i] ) ) ) ) } ) )
      .sort( ( a, b ) => a.distance - b.distance || a.id - b.id );
    assert.equal( result[0].id, expected[0].id );
    for ( let i = 0; i < result.length; i++ ) {
      const item = result[i];
      assert.ok( item.adapted.includes( hex.toUpperCase() ) );
      assert.equal( item.adapted.length, item.original.length );
      assert.ok( item.adapted.filter( ( value, j ) => value !== item.original[j] ).length <= 1 );
      assert.deepEqual( item.original, palettes.find( value => value.id === item.id ).colors );
      assert.equal( new Set( item.adapted ).size, item.adapted.length );
      if ( i ) assert.ok( item.distance >= result[i - 1].distance );
    }
  }
  assert.equal( findHistoricalPalettes( data[0].hex )[0].distance, 0 );
  const first = findHistoricalPalettes( '#123456' );
  first[0].adapted[0] = '#FFFFFF';
  assert.notDeepEqual( first, findHistoricalPalettes( '#123456' ) );
  assert.throws( () => { first[0].original[0] = '#FFFFFF'; }, TypeError );
  for ( const limit of [0, -1, 21, 1.5, NaN] ) assert.throws( () => findHistoricalPalettes( '#123456', limit ) );
  assert.equal( findHistoricalPalettes( '#123456', 1 ).length, 1 );
  assert.throws( () => findHistoricalPalettes( 'invalid' ) );
} );
