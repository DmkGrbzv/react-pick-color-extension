import {
  GET_PALETTE,
  ADD_COLOR,
  REMOVE_COLOR,
  SAVE_GRADIENT,
  findCorrectMessageType,
} from '@/messageTypes.js';
import { sendRequest, requireExtension } from '@/runtime/sendRequest.js';
import { createStorageAdapter } from '@/storage.js';
import { readPaletteValue } from '@/services/paletteRepository.js';
import { PALETTE_KEY } from '@/types.js';

export const getPalette = () => sendRequest( { type: findCorrectMessageType( GET_PALETTE ) } );
export const addColor = ( hex ) => sendRequest( { type: findCorrectMessageType( ADD_COLOR ), hex } );
export const removeColor = ( id ) => sendRequest( { type: findCorrectMessageType( REMOVE_COLOR ), id } );
export const saveGradient = ( gradient ) =>
  sendRequest( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient } );

export function subscribeToPalette( onChange, onError ) {
  // Event callbacks cannot reject a caller's promise: forward failures to the UI explicitly.
  try {
    requireExtension();
    return createStorageAdapter( chrome.storage ).subscribe( PALETTE_KEY, ( value ) => {
      let palette;
      try {
        palette = readPaletteValue( value );
      } catch ( error ) {
        onError( error );
        return;
      }
      onChange( palette );
    } );
  } catch ( error ) {
    onError( error );
    return () => {};
  }
}
