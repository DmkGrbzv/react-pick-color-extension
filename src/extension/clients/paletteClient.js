import {
  GET_PALETTE,
  ADD_COLOR,
  REMOVE_COLOR,
  SAVE_GRADIENT,
  findCorrectMessageType,
} from '@/extension/messaging/messageTypes.js';
import { sendRequest, requireExtension } from '@/extension/messaging/sendRequest.js';
import { StorageAdapter } from '@/services/storage.js';
import { readPaletteValue } from '@/features/palette/services/paletteRepository.js';
import { PALETTE_KEY } from '@/types/palette.js';

export const getPalette = () => sendRequest( { type: findCorrectMessageType( GET_PALETTE ) } );
export const addColor = ( hex ) => sendRequest( { type: findCorrectMessageType( ADD_COLOR ), hex } );
export const removeColor = ( id ) => sendRequest( { type: findCorrectMessageType( REMOVE_COLOR ), id } );
export const saveGradient = ( gradient ) =>
  sendRequest( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient } );

export function subscribeToPalette( onChange, onError ) {
  // Event callbacks cannot reject a caller's promise: forward failures to the UI explicitly.
  try {
    requireExtension();
    return new StorageAdapter( chrome.storage ).subscribe( PALETTE_KEY, ( value ) => {
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
