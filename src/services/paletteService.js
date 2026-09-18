import { AppError } from '@/errors.js';
import { normalizeGradient } from '@/gradient.js';

// Only recover the previous request; failures in this task reach its caller.
async function runPaletteTask( previousOperation, task ) {
  try {
    await previousOperation;
  } catch {
    // Continue processing later palette requests after a failed read or write.
  }
  return await task();
}

export function createPaletteService( repository, makeId = () => crypto.randomUUID() ) {
  let tail;

  function enqueue( task ) {
    tail = runPaletteTask( tail, task );
    return tail;
  }

  function update( transform ) {
    return enqueue( async () => {
      const current = await repository.read();
      const next = transform( current );
      if ( next !== current ) await repository.write( next );
      return next;
    } );
  }

  function getPalette() {
    return enqueue( () => repository.read() );
  }

  function addColor( value ) {
    return update( ( palette ) => {
      if ( typeof value !== 'string' || !/^#[\da-f]{6}$/i.test( value ) ) {
        throw new AppError( 'invalidHex' );
      }
      const hex = value.toUpperCase();
      const exists = palette.colors.some(
        ( item ) => item.type !== 'gradient' && item.hex.toUpperCase() === hex
      );
      if ( exists ) return palette;
      return { ...palette, colors: [...palette.colors, { id: makeId(), hex }] };
    } );
  }

  function saveGradient( value ) {
    return update( ( palette ) => {
      const gradient = normalizeGradient( value );
      if ( value.id === undefined ) {
        return { ...palette, colors: [...palette.colors, { id: makeId(), ...gradient }] };
      }
      const index = palette.colors.findIndex(
        ( item ) => item.id === value.id && item.type === 'gradient'
      );
      if ( index < 0 ) throw new AppError( 'gradientMissing' );
      return {
        ...palette,
        colors: palette.colors.map( ( item, position ) =>
          position === index ? { id: value.id, ...gradient } : item
        ),
      };
    } );
  }

  function removeItem( id ) {
    return update( ( palette ) => {
      if ( typeof id !== 'string' ) throw new AppError( 'missingColor' );
      return { ...palette, colors: palette.colors.filter( ( item ) => item.id !== id ) };
    } );
  }

  return { getPalette, addColor, saveGradient, removeItem };
}
