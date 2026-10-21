import { ERROR_CODES } from '@/constants/errorCodes.js';
import { createEmptyPalette, isPalette, PALETTE_KEY } from '@/types/palette.js';
import { AppError } from '@/utils/errors.js';

export function readPaletteValue( value ) {
  const palette = value ?? createEmptyPalette();
  if ( !isPalette( palette ) ) throw new AppError( ERROR_CODES.INVALID_PALETTE );
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
