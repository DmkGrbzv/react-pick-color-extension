export const GET_PALETTE = 'GET_PALETTE';
export const ADD_COLOR = 'ADD_COLOR';
export const REMOVE_COLOR = 'REMOVE_COLOR';
export const SAVE_GRADIENT = 'SAVE_GRADIENT';
export const OPEN_EDITOR = 'OPEN_EDITOR';

// Keep the existing transport values stable for all extension contexts.
export const MESSAGE_TYPES = Object.freeze( [
  Object.freeze( { key: GET_PALETTE, type: 'palette:get' } ),
  Object.freeze( { key: ADD_COLOR, type: 'palette:add' } ),
  Object.freeze( { key: REMOVE_COLOR, type: 'palette:remove' } ),
  Object.freeze( { key: SAVE_GRADIENT, type: 'gradient:save' } ),
  Object.freeze( { key: OPEN_EDITOR, type: 'editor:open' } ),
] );

export function findCorrectMessageType( key ) {
  const message = MESSAGE_TYPES.find( ( entry ) => entry.key === key );
  if ( !message ) throw new RangeError( 'Unknown message key: ' + key );
  return message.type;
}

export function isMessageType( type ) {
  return MESSAGE_TYPES.some( ( entry ) => entry.type === type );
}
