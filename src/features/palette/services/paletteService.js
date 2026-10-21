import { ERROR_CODES } from '@/constants/errorCodes.js';
import { AppError } from '@/utils/errors.js';
import { normalizeGradient } from '@/utils/gradient.js';
import { isPalette } from '@/types/palette.js';
import { paletteVersion, snapshotSignature } from '@/utils/paletteSnapshot.js';

// Only recover the previous request; failures in this task reach its caller.
async function runPaletteTask( previousOperation, task ) {
  try {
    await previousOperation;
  } catch {
    // Continue processing later palette requests after a failed read or write.
  }
  return await task();
}

export class PaletteService {
  #repository;
  #makeId;
  #tail;
  constructor( repository, makeId = () => crypto.randomUUID() ) {
    this.#repository = repository;
    this.#makeId = makeId;
  }

  #enqueue( task ) {
    this.#tail = runPaletteTask( this.#tail, task );
    return this.#tail;
  }

  #update( transform ) {
    return this.#enqueue( async () => {
      const current = await this.#repository.read();
      const next = transform( current );
      if ( next !== current ) await this.#repository.write( next );
      return next;
    } );
  }

  getPalette() {
    return this.#enqueue( () => this.#repository.read() );
  }

  markSavedSource( source, commit ) {
    return this.#enqueue( async () => {
      const current = await this.#repository.read();
      if ( !current.colors.length || snapshotSignature( current ) !== source.signature ) return;
      await commit( () => this.#repository.write( { ...current, cloudSource: source } ) );
    } );
  }

  clearSavedSource( id, ownerId ) {
    return this.#update( ( palette ) => {
      if ( palette.cloudSource?.id !== id || palette.cloudSource.ownerId !== ownerId ) return palette;
      const { cloudSource: _source, ...working } = palette;
      return working;
    } );
  }

  replacePalette( replacement, expectedVersion, commit ) {
    return this.#enqueue( async () => {
      if ( !isPalette( replacement ) ) throw new AppError( ERROR_CODES.INVALID_PALETTE );
      const current = await this.#repository.read();
      if ( paletteVersion( current ) !== expectedVersion ) throw new AppError( 'paletteChanged' );
      await commit( () => this.#repository.write( replacement ) );
      return replacement;
    } );
  }

  addColor( value ) {
    return this.#update( ( palette ) => {
      if ( typeof value !== 'string' || !/^#[\da-f]{6}$/i.test( value ) ) {
        throw new AppError( ERROR_CODES.INVALID_HEX );
      }
      const hex = value.toUpperCase();
      const exists = palette.colors.some(
        ( item ) => item.type !== 'gradient' && item.hex.toUpperCase() === hex
      );
      if ( exists ) return palette;
      return { ...palette, colors: [...palette.colors, { id: this.#makeId(), hex }] };
    } );
  }

  saveGradient( value ) {
    return this.#update( ( palette ) => {
      const gradient = normalizeGradient( value );
      if ( value.id === undefined ) {
        return { ...palette, colors: [...palette.colors, { id: this.#makeId(), ...gradient }] };
      }
      const index = palette.colors.findIndex(
        ( item ) => item.id === value.id && item.type === 'gradient'
      );
      if ( index < 0 ) throw new AppError( ERROR_CODES.GRADIENT_MISSING );
      return {
        ...palette,
        colors: palette.colors.map( ( item, position ) =>
          position === index ? { id: value.id, ...gradient } : item
        ),
      };
    } );
  }

  removeItem( id ) {
    return this.#update( ( palette ) => {
      if ( typeof id !== 'string' ) throw new AppError( ERROR_CODES.MISSING_COLOR );
      return { ...palette, colors: palette.colors.filter( ( item ) => item.id !== id ) };
    } );
  }
}
