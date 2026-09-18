import { createEmptyPalette, isPalette, PALETTE_KEY } from '@/types.js';
import { AppError } from '@/errors.js';

export function readPaletteValue( value ) {
  const palette = value ?? createEmptyPalette();
  if ( !isPalette( palette ) ) throw new AppError( 'invalidPalette' );
  return palette;
}

export class PaletteRepository {
  #storage;
  constructor( storage ) {
    this.#storage = storage;
  }
  async read() {
    return readPaletteValue( await this.#storage.get( PALETTE_KEY ) );
  }
  write( palette ) {
    return this.#storage.set( PALETTE_KEY, palette );
  }
}
