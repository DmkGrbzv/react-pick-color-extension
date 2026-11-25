import data from '../data/sanzoWada.json' with { type: 'json' };
import { hexToRgb } from '@/utils/colorConversion.js';

// sRGB -> CIELAB with D65 white; compare both sources using their displayed HEX.
export function hexToLab( hex ) {
  const { red, green, blue } = hexToRgb( hex );
  const [r, g, b] = [red, green, blue].map( value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ( ( channel + 0.055 ) / 1.055 ) ** 2.4;
  } );
  const curve = value => value > 216 / 24389 ? Math.cbrt( value ) : value * 841 / 108 + 4 / 29;
  const x = curve( ( r * 0.4124564 + g * 0.3575761 + b * 0.1804375 ) / 0.95047 );
  const y = curve( r * 0.2126729 + g * 0.7151522 + b * 0.072175 );
  const z = curve( ( r * 0.0193339 + g * 0.119192 + b * 0.9503041 ) / 1.08883 );
  return [116 * y - 16, 500 * ( x - y ), 200 * ( y - z )];
}

export function buildHistoricalPalettes( records ) {
  if ( !Array.isArray( records ) || records.length !== 159 ) throw new Error( 'Invalid historical dataset' );
  const combinations = new Map();
  const hexes = new Set();
  for ( const record of records ) {
    if ( !record || typeof record.name !== 'string' || !record.name.trim() ||
      typeof record.hex !== 'string' || !/^#[\da-f]{6}$/i.test( record.hex ) || !Array.isArray( record.combinations ) ||
      !record.combinations.length || new Set( record.combinations ).size !== record.combinations.length ) {
      throw new Error( 'Invalid historical color' );
    }
    const hex = record.hex.toUpperCase();
    if ( hexes.has( hex ) ) throw new Error( 'Duplicate historical color' );
    hexes.add( hex );
    for ( const id of record.combinations ) {
      if ( !Number.isInteger( id ) || id < 1 || id > 348 ) throw new Error( 'Invalid historical reference' );
      if ( !combinations.has( id ) ) combinations.set( id, [] );
      combinations.get( id ).push( hex );
    }
  }
  if ( combinations.size !== 348 ) throw new Error( 'Missing historical combinations' );
  return Object.freeze( [...combinations].sort( ( a, b ) => a[0] - b[0] ).map( ( [id, colors] ) => {
    if ( colors.length < 2 || colors.length > 4 ) throw new Error( 'Invalid historical combination size' );
    return Object.freeze( { id, colors: Object.freeze( colors ),
      labs: Object.freeze( colors.map( hex => Object.freeze( hexToLab( hex ) ) ) ) } );
  } ) );
}

const palettes = buildHistoricalPalettes( data );

// Delta E 1976 with explicit combination ID and color index tie breaks.
export function findHistoricalPalettes( hex, limit = 6 ) {
  if ( !Number.isInteger( limit ) || limit < 1 || limit > 20 ) throw new RangeError( 'Invalid result limit' );
  const lab = hexToLab( hex );
  const source = '#' + Object.values( hexToRgb( hex ) ).map( value => value.toString( 16 ).padStart( 2, '0' ) ).join( '' ).toUpperCase();
  const seen = new Set();
  return palettes.map( palette => {
    const distances = palette.labs.map( value => Math.hypot( ...value.map( ( channel, i ) => channel - lab[i] ) ) );
    const distance = Math.min( ...distances );
    const index = distances.indexOf( distance );
    return { id: palette.id, distance, original: palette.colors,
      adapted: palette.colors.map( ( value, i ) => i === index ? source : value ) };
  } ).sort( ( a, b ) => a.distance - b.distance || a.id - b.id ).filter( palette => {
    const signature = [...palette.original].sort().join( ',' );
    if ( seen.has( signature ) ) return false;
    seen.add( signature );
    return true;
  } ).slice( 0, limit );
}
