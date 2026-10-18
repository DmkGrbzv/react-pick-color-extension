import { isPalette } from '@/types.js';
import { normalizeGradient } from '@/gradient.js';
import { AppError } from '@/errors.js';

export function createCloudSnapshot( palette ) {
  if ( !isPalette( palette ) || !palette.colors.length || palette.colors.length > 256 ) {
    throw new AppError( 'invalidPalette' );
  }
  return { name: palette.name, items: snapshotItems( palette ) };
}

function snapshotItems( palette ) {
  return palette.colors.map( ( item ) => item.type === 'gradient'
    ? normalizeGradient( item ) : { type: 'color', hex: item.hex.toUpperCase() } );
}

export function restoreCloudSnapshot( snapshot, makeId = () => crypto.randomUUID() ) {
  if ( !snapshot || typeof snapshot.name !== 'string' || !Array.isArray( snapshot.items ) ||
    !snapshot.items.length || snapshot.items.length > 256 ) throw new AppError( 'invalidPalette' );
  const colors = snapshot.items.map( ( item ) => {
    if ( item?.type === 'gradient' ) return { id: makeId(), ...normalizeGradient( item ) };
    if ( item?.type !== 'color' ) throw new AppError( 'invalidPalette' );
    return { id: makeId(), hex: item.hex };
  } );
  const palette = { id: 'current', name: snapshot.name || 'My palette', colors };
  if ( !isPalette( palette ) ) throw new AppError( 'invalidPalette' );
  return palette;
}

// Compare the complete local value, including IDs, to protect the user's confirmation.
export const paletteVersion = ( palette ) => JSON.stringify( palette );

// Local card IDs and UI state do not affect the saved content.
export function snapshotSignature( palette ) {
  return JSON.stringify( { name: palette.name, items: snapshotItems( palette ) } );
}

export function isSavedPalette( palette, ownerId ) {
  if ( !palette?.colors.length || !ownerId || palette.cloudSource?.ownerId !== ownerId ) return false;
  return palette.cloudSource.signature === snapshotSignature( palette );
}
