import { ApiError } from '../http/apiError.js';
import { digest } from '../auth/crypto.js';

function exactKeys( value, allowed ) {
  return value && typeof value === 'object' && !Array.isArray( value ) &&
    Object.keys( value ).every( ( key ) => allowed.includes( key ) );
}

function hex( value ) {
  if ( typeof value !== 'string' || !/^#[\da-f]{6}$/i.test( value ) ) {
    throw new ApiError( 400, 'invalidPalette' );
  }
  return value.toUpperCase();
}

function stop( value ) {
  if ( !exactKeys( value, ['hex', 'position'] ) || !Number.isFinite( value.position ) ||
    value.position < 0 || value.position > 100 ) throw new ApiError( 400, 'invalidPalette' );
  return { hex: hex( value.hex ), position: value.position };
}

export function normalizeItem( value ) {
  if ( !exactKeys( value, ['type', 'hex', 'gradientType', 'direction', 'stops'] ) ) {
    throw new ApiError( 400, 'invalidPalette' );
  }
  if ( value.type === 'color' && exactKeys( value, ['type', 'hex'] ) ) {
    return { type: 'color', hex: hex( value.hex ) };
  }
  if ( value.type !== 'gradient' || !exactKeys( value, ['type', 'gradientType', 'direction', 'stops'] ) ||
    value.gradientType !== 'linear' || !['right', 'left', 'down', 'up'].includes( value.direction ) ||
    !Array.isArray( value.stops ) || value.stops.length !== 2 ) throw new ApiError( 400, 'invalidPalette' );
  const stops = value.stops.map( stop );
  if ( stops[0].position > stops[1].position ) throw new ApiError( 400, 'invalidPalette' );
  return { type: 'gradient', gradientType: 'linear', direction: value.direction, stops };
}

export function paletteName( value ) {
  if ( typeof value !== 'string' || value.trim().length > 120 ||
    [...value].some( ( character ) => character.charCodeAt( 0 ) < 32 ) ) {
    throw new ApiError( 400, 'invalidPalette' );
  }
  return value.trim();
}

export function normalizeSnapshot( input, maxItems ) {
  if ( !exactKeys( input, ['items', 'name'] ) || !Array.isArray( input.items ) ||
    input.items.length === 0 || input.items.length > maxItems ) throw new ApiError( 400, 'invalidPalette' );
  const normalized = input.items.map( normalizeItem );
  const seen = new Set();
  const items = normalized.filter( ( item ) => {
    const key = JSON.stringify( item );
    if ( seen.has( key ) ) return false;
    seen.add( key );
    return true;
  } );
  return { name: paletteName( input.name ?? '' ), items };
}

export function saveKey( key ) {
  if ( typeof key !== 'string' || !/^[\w-]{16,128}$/.test( key ) ) {
    throw new ApiError( 400, 'invalidSaveKey' );
  }
  return key;
}

export const snapshotHash = ( snapshot ) => digest( JSON.stringify( snapshot ) );

export function encodeCursor( document ) {
  return Buffer.from( JSON.stringify( { date: document.createdAt.toISOString(), id: document._id } ) ).toString( 'base64url' );
}

export function decodeCursor( cursor ) {
  if ( cursor === undefined ) return null;
  try {
    if ( typeof cursor !== 'string' || cursor.length > 256 ) throw new Error();
    const value = JSON.parse( Buffer.from( cursor, 'base64url' ).toString() );
    if ( !exactKeys( value, ['date', 'id'] ) || typeof value.id !== 'string' ||
      !/^[\da-f-]{36}$/i.test( value.id ) || !Number.isFinite( Date.parse( value.date ) ) ) throw new Error();
    return { date: new Date( value.date ), id: value.id };
  } catch {
    throw new ApiError( 400, 'invalidCursor' );
  }
}

export function publicPalette( document ) {
  return { id: document._id, name: document.name, items: document.items, createdAt: document.createdAt };
}
