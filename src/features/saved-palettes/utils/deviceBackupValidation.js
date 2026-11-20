import { AppError } from '@/utils/errors.js';
import { normalizeGradient } from '@/utils/gradient.js';

export const BACKUP_KEY = 'devicePaletteBackup';
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
export const MAX_BACKUP_PALETTES = 1000;
const invalid = () => { throw new AppError( 'invalidBackup' ); };
const bytes = ( value ) => new TextEncoder().encode( JSON.stringify( value ) ).length;

export function exactBackupKeys( value, keys ) {
  if ( !value || typeof value !== 'object' || Array.isArray( value ) ||
    Object.keys( value ).length !== keys.length || Object.keys( value ).some( ( key ) => !keys.includes( key ) ) ) invalid();
}

function item( value ) {
  if ( value?.type === 'color' ) {
    exactBackupKeys( value, ['type', 'hex'] );
    if ( typeof value.hex !== 'string' || !/^#[\da-f]{6}$/i.test( value.hex ) ) invalid();
    return { type: 'color', hex: value.hex.toUpperCase() };
  }
  exactBackupKeys( value, ['type', 'gradientType', 'direction', 'stops'] );
  if ( !Array.isArray( value.stops ) || value.stops.length !== 2 ) invalid();
  for ( const stop of value.stops ) {
    exactBackupKeys( stop, ['hex', 'position'] );
    if ( typeof stop.hex !== 'string' || !/^#[\da-f]{6}$/i.test( stop.hex ) ||
      !Number.isInteger( stop.position ) || stop.position < 0 || stop.position > 100 ) invalid();
  }
  try { return normalizeGradient( value ); } catch { invalid(); }
}

export function validateBackupPalette( value ) {
  exactBackupKeys( value, ['name', 'items'] );
  if ( typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 ||
    [...value.name].some( ( character ) => character.charCodeAt( 0 ) < 32 || character.charCodeAt( 0 ) === 127 ) || !Array.isArray( value.items ) ||
    !value.items.length || value.items.length > 256 || bytes( value ) > 65536 ) invalid();
  return { name: value.name, items: value.items.map( item ) };
}

export function validateDeviceBackup( value ) {
  exactBackupKeys( value, ['version', 'createdAt', 'count', 'palettes'] );
  if ( value.version !== 1 || typeof value.createdAt !== 'string' ||
    !Number.isFinite( Date.parse( value.createdAt ) ) || value.createdAt !== new Date( value.createdAt ).toISOString() ||
    !Array.isArray( value.palettes ) || value.palettes.length > MAX_BACKUP_PALETTES ||
    value.count !== value.palettes.length || bytes( value ) > MAX_BACKUP_BYTES ) invalid();
  return { version: 1, createdAt: value.createdAt, count: value.count,
    palettes: value.palettes.map( validateBackupPalette ) };
}

export function validateBackupRecord( value ) {
  exactBackupKeys( value, ['id', 'name', 'items', 'createdAt'] );
  if ( typeof value.id !== 'string' || !/^[\da-f-]{36}$/i.test( value.id ) ||
    typeof value.createdAt !== 'string' || !Number.isFinite( Date.parse( value.createdAt ) ) ) invalid();
  return { id: value.id, palette: validateBackupPalette( { name: value.name, items: value.items } ) };
}
