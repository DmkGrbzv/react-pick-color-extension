import { createEmptyPalette, isPalette, PALETTE_KEY } from '@/types.js';
import { AppError } from '@/errors.js';

export function readPaletteValue( value ) {
  const palette = value ?? createEmptyPalette();
  if ( !isPalette( palette ) ) throw new AppError( 'invalidPalette' );
  return palette;
}

export function createPaletteRepository( storage ) {
  return {
    async read() {
      return readPaletteValue( await storage.get( PALETTE_KEY ) );
    },
    write( palette ) {
      return storage.set( PALETTE_KEY, palette );
    },
  };
}
