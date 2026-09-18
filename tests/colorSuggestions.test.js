import test from 'node:test';
import assert from 'node:assert/strict';
import { createColorSuggestions } from '@/utils/colorSuggestions.js';
import { hexToRgb } from '@/utils/colorConversion.js';

test( 'hue combinations are deterministic and match primary-color rotations', () => {
  const suggestions = createColorSuggestions( '#ff0000' );
  assert.deepEqual( suggestions, createColorSuggestions( '#F00' ) );
  assert.equal( suggestions.source, '#FF0000' );
  assert.deepEqual( suggestions.analogous, ['#FF0080', '#FF0000', '#FF8000'] );
  assert.deepEqual( suggestions.complementary, ['#00FFFF'] );
  assert.deepEqual( suggestions.triadic, ['#00FF00', '#0000FF'] );
  assert.equal( suggestions.isNeutral, false );
} );

test( 'black, white and nearly gray colors offer distinct shades without arbitrary hue suggestions', () => {
  for ( const hex of ['#000000', '#FFFFFF', '#808080', '#80808F', '#050000', '#FFF5FA'] ) {
    const result = createColorSuggestions( hex );
    assert.equal( result.isNeutral, true, hex );
    assert.ok( result.shades.length >= 3 );
    assert.equal( new Set( result.shades ).size, result.shades.length );
    assert.ok( !result.shades.includes( result.source ) );
    for ( const shade of result.shades ) {
      const channels = Object.values( hexToRgb( shade ) );
      assert.ok( Math.max( ...channels ) - Math.min( ...channels ) <= 16 );
    }
    assert.deepEqual( result.analogous, [] );
    assert.deepEqual( result.complementary, [] );
    assert.deepEqual( result.triadic, [] );
  }
} );

test( 'shades contain darker and lighter variants and all suggestions are valid opaque HEX', () => {
  const samples = ['#7F39C4', '#FF0090', '#01F09A', '#123456', '#FAFAFA', '#010101'];
  const lightness = ( hex ) => {
    const values = Object.values( hexToRgb( hex ) );
    return ( Math.max( ...values ) + Math.min( ...values ) ) / 2;
  };
  for ( const hex of samples ) {
    const result = createColorSuggestions( hex );
    assert.equal( result.source, hex );
    for ( const values of [result.shades, result.analogous, result.complementary, result.triadic] ) {
      for ( const value of values ) assert.match( value, /^#[0-9A-F]{6}$/ );
    }
    assert.deepEqual( result, createColorSuggestions( hex ) );
  }
  const purple = createColorSuggestions( samples[0] );
  assert.ok( purple.shades.some( ( hex ) => lightness( hex ) < lightness( purple.source ) ) );
  assert.ok( purple.shades.some( ( hex ) => lightness( hex ) > lightness( purple.source ) ) );
  assert.throws( () => createColorSuggestions( 'purple' ) );
} );
