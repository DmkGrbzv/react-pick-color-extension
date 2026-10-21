import { hexToRgb } from '@/utils/colorConversion.js';

// A small RGB channel spread is visually close to neutral, even at high HSL saturation.
const NEUTRAL_CHANNEL_SPREAD = 16;
const SHADE_MIXES = [-0.6, -0.4, -0.2, 0.2, 0.4, 0.6];

function channelsToHex( channels ) {
  return '#' + channels.map( value => Math.round( value ).toString( 16 ).padStart( 2, '0' ) ).join( '' ).toUpperCase();
}

function rgbToHsl( { red, green, blue } ) {
  const [r, g, b] = [red, green, blue].map( ( value ) => value / 255 );
  const maximum = Math.max( r, g, b );
  const minimum = Math.min( r, g, b );
  const chroma = maximum - minimum;
  const lightness = ( maximum + minimum ) / 2;
  if ( chroma === 0 ) return { hue: 0, saturation: 0, lightness };
  let hue;
  if ( maximum === r ) hue = ( ( g - b ) / chroma ) % 6;
  else if ( maximum === g ) hue = ( b - r ) / chroma + 2;
  else hue = ( r - g ) / chroma + 4;
  return {
    hue: ( hue * 60 + 360 ) % 360,
    saturation: chroma / ( 1 - Math.abs( 2 * lightness - 1 ) ),
    lightness,
  };
}

function hslToHex( { hue, saturation, lightness } ) {
  const chroma = ( 1 - Math.abs( 2 * lightness - 1 ) ) * saturation;
  const sector = ( ( ( hue % 360 ) + 360 ) % 360 ) / 60;
  const intermediate = chroma * ( 1 - Math.abs( ( sector % 2 ) - 1 ) );
  const offset = lightness - chroma / 2;
  const channels = [
    [chroma, intermediate, 0],
    [intermediate, chroma, 0],
    [0, chroma, intermediate],
    [0, intermediate, chroma],
    [intermediate, 0, chroma],
    [chroma, 0, intermediate],
  ][Math.floor( sector )];
  return channelsToHex( channels.map( value => ( value + offset ) * 255 ) );
}

// Pure and deterministic. HSL is used only for calculations; results remain HEX.
export function createColorSuggestions( hex ) {
  const rgb = hexToRgb( hex );
  const base = rgbToHsl( rgb );
  const source = channelsToHex( [rgb.red, rgb.green, rgb.blue] );
  const spread = Math.max( rgb.red, rgb.green, rgb.blue ) - Math.min( rgb.red, rgb.green, rgb.blue );
  const isNeutral = spread <= NEUTRAL_CHANNEL_SPREAD;
  // Mix with black/white directly so nearly neutral colors remain neutral.
  const shades = SHADE_MIXES.map( amount => {
    const target = amount < 0 ? 0 : 255;
    return channelsToHex( [rgb.red, rgb.green, rgb.blue].map( channel =>
      channel + ( target - channel ) * Math.abs( amount )
    ) );
  } );
  const rotateHue = ( degrees ) => hslToHex( { ...base, hue: base.hue + degrees } );
  return {
    source,
    isNeutral,
    shades: [...new Set( shades )].filter( ( value ) => value !== source ),
    analogous: isNeutral ? [] : [rotateHue( -30 ), source, rotateHue( 30 )],
    complementary: isNeutral ? [] : [rotateHue( 180 )],
    triadic: isNeutral ? [] : [rotateHue( 120 ), rotateHue( 240 )],
  };
}
