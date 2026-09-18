import { AppError } from '@/errors.js';

export const DIRECTIONS = { right: 'to right', left: 'to left', down: 'to bottom', up: 'to top' };

export function normalizeHex( value ) {
  if ( typeof value !== 'string' ) return null;
  const hex = value.trim();
  if ( /^#[0-9a-f]{6}$/i.test( hex ) ) return hex.toUpperCase();
  if ( /^#[0-9a-f]{3}$/i.test( hex ) )
    return (
      '#' +
      [...hex.slice( 1 )]
        .map( ( c ) => c + c )
        .join( '' )
        .toUpperCase()
    );
  return null;
}

export function validPosition( value ) {
  return (
    ( typeof value === 'number' || typeof value === 'string' ) &&
    String( value ).trim() !== '' &&
    Number.isInteger( Number( value ) ) &&
    Number( value ) >= 0 &&
    Number( value ) <= 100
  );
}

export function normalizeGradient( value ) {
  if (
    !value ||
    value.type !== 'gradient' ||
    value.gradientType !== 'linear' ||
    !Object.hasOwn( DIRECTIONS, value.direction ) ||
    !Array.isArray( value.stops ) ||
    value.stops.length !== 2 ||
    value.stops.some( ( stop ) => !stop || !normalizeHex( stop.hex ) || !validPosition( stop.position ) ) ||
    Number( value.stops[0].position ) > Number( value.stops[1].position )
  )
    throw new AppError( 'invalidGradient' );
  return {
    type: 'gradient',
    gradientType: 'linear',
    direction: value.direction,
    stops: value.stops.map( ( stop ) => ( {
      hex: normalizeHex( stop.hex ),
      position: Number( stop.position ),
    } ) ),
  };
}

// The single CSS source for the preview, saved swatch and clipboard declaration.
export function gradientCss( value ) {
  const gradient = normalizeGradient( value );
  return `linear-gradient(${DIRECTIONS[gradient.direction]}, ${gradient.stops.map( ( stop ) => `${stop.hex} ${stop.position}%` ).join( ', ' )})`;
}

export function gradientDeclaration( value ) {
  return `background: ${gradientCss( value )};`;
}

export function createGradientDraft( item ) {
  const value = item
    ? normalizeGradient( item )
    : {
        type: 'gradient',
        gradientType: 'linear',
        direction: 'right',
        stops: [
          { hex: '#000000', position: 0 },
          { hex: '#FFFFFF', position: 100 },
        ],
      };
  const fields = {
    direction: value.direction,
    stops: value.stops.map( ( stop ) => ( { ...stop, position: String( stop.position ) } ) ),
  };
  return { ...fields, id: item?.id ?? null, preview: value, baseline: JSON.stringify( fields ) };
}

export function draftErrors( draft ) {
  const hex = draft.stops.map( ( stop ) => !normalizeHex( stop.hex ) );
  const position = draft.stops.map( ( stop ) => !validPosition( stop.position ) );
  const order =
    !position.some( Boolean ) && Number( draft.stops[0].position ) > Number( draft.stops[1].position );
  return { hex, position, order, invalid: hex.some( Boolean ) || position.some( Boolean ) || order };
}

export function draftDirty( draft ) {
  return JSON.stringify( { direction: draft.direction, stops: draft.stops } ) !== draft.baseline;
}

// Keep raw form input in the draft; render only valid values in its preview.
export function updateGradientDraft( draft, action ) {
  const updatedDraft = {
    ...draft,
    stops: draft.stops.map( ( stop ) => ( { ...stop } ) ),
  };

  switch ( action.type ) {
    case 'hex':
      updatedDraft.stops[action.index].hex = action.value;
      break;
    case 'position':
      updatedDraft.stops[action.index].position = action.value;
      break;
    case 'direction':
      if ( Object.hasOwn( DIRECTIONS, action.value ) ) updatedDraft.direction = action.value;
      break;
    case 'swap':
      // Swap colors only; their positions stay in place.
      updatedDraft.stops[0].hex = draft.stops[1].hex;
      updatedDraft.stops[1].hex = draft.stops[0].hex;
      break;
    case 'slider': {
      const neighborIndex = action.index === 0 ? 1 : 0;
      const neighborInput = draft.stops[neighborIndex].position;
      // If the neighboring input is invalid, use its last valid preview position.
      const neighborPosition = validPosition( neighborInput )
        ? Number( neighborInput )
        : draft.preview.stops[neighborIndex].position;
      const roundedPosition = Math.round( Number( action.value ) );
      const boundedPosition = Math.max( 0, Math.min( 100, roundedPosition ) );
      // Sliders may meet but cannot cross each other.
      const sliderPosition = action.index === 0
        ? Math.min( boundedPosition, neighborPosition )
        : Math.max( boundedPosition, neighborPosition );
      updatedDraft.stops[action.index].position = String( sliderPosition );
      break;
    }
  }

  const errors = draftErrors( updatedDraft );
  // Positions form a pair: keep both previous positions if either is invalid or they cross.
  const keepPreviousPositions = errors.order || errors.position.some( Boolean );
  updatedDraft.preview = {
    ...draft.preview,
    direction: updatedDraft.direction,
    stops: updatedDraft.stops.map( ( stop, index ) => {
      const previousStop = draft.preview.stops[index];
      return {
        // Colors are independent: an invalid HEX keeps only its own previous color.
        hex: normalizeHex( stop.hex ) || previousStop.hex,
        position: keepPreviousPositions ? previousStop.position : Number( stop.position ),
      };
    } ),
  };
  return updatedDraft;
}

export function gradientFromDraft( draft ) {
  if ( draftErrors( draft ).invalid ) throw new AppError( 'invalidGradient' );
  return {
    ...normalizeGradient( { ...draft, type: 'gradient', gradientType: 'linear' } ),
    ...( draft.id ? { id: draft.id } : {} ),
  };
}
