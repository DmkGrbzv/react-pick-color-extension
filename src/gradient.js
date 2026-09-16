import { AppError } from './errors.js';

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

export function updateGradientDraft( draft, action ) {
  const next = { ...draft, stops: draft.stops.map( ( stop ) => ( { ...stop } ) ) };
  if ( action.type === 'hex' ) next.stops[action.index].hex = action.value;
  if ( action.type === 'position' ) next.stops[action.index].position = action.value;
  if ( action.type === 'direction' && Object.hasOwn( DIRECTIONS, action.value ) )
    next.direction = action.value;
  if ( action.type === 'swap' )
    [next.stops[0].hex, next.stops[1].hex] = [next.stops[1].hex, next.stops[0].hex];
  if ( action.type === 'slider' ) {
    const other = 1 - action.index;
    const limit = validPosition( next.stops[other].position )
      ? Number( next.stops[other].position )
      : draft.preview.stops[other].position;
    const value = Math.max( 0, Math.min( 100, Math.round( Number( action.value ) ) ) );
    next.stops[action.index].position = String(
      action.index === 0 ? Math.min( value, limit ) : Math.max( value, limit )
    );
  }
  const errors = draftErrors( next );
  // Invalid fields retain their last valid preview value; other valid controls remain live.
  next.preview = {
    ...draft.preview,
    direction: next.direction,
    stops: next.stops.map( ( stop, index ) => ( {
      hex: normalizeHex( stop.hex ) || draft.preview.stops[index].hex,
      position:
        errors.order || errors.position.some( Boolean )
          ? draft.preview.stops[index].position
          : Number( stop.position ),
    } ) ),
  };
  return next;
}

export function gradientFromDraft( draft ) {
  if ( draftErrors( draft ).invalid ) throw new AppError( 'invalidGradient' );
  return {
    ...normalizeGradient( { ...draft, type: 'gradient', gradientType: 'linear' } ),
    ...( draft.id ? { id: draft.id } : {} ),
  };
}
