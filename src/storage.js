import {
  GETPALETTE,
  ADDCOLOR,
  REMOVECOLOR,
  SAVEGRADIENT,
  OPENEDITOR,
  findCorrectMassageType,
} from './messageTypes.js';
import { normalizeGradient } from './gradient.js';
import { AppError } from './errors.js';
import { createEmptyPalette, isPalette, PALETTE_KEY } from './types.js';

// All read-modify-write operations run in the worker, never in individual views.
// A failed write must not block subsequent requests.
export function createPaletteService( storage, makeId = () => crypto.randomUUID() ) {
  let queue = Promise.resolve();

  return function execute( message ) {
    const operation = queue.then( async () => {
      const stored = await storage.get( PALETTE_KEY );
      const palette = stored[PALETTE_KEY] ?? createEmptyPalette();
      if ( !isPalette( palette ) ) throw new AppError( 'invalidPalette' );

      if ( message.type === findCorrectMassageType( GETPALETTE ) ) return palette;

      if ( message.type === findCorrectMassageType( ADDCOLOR ) ) {
        if ( typeof message.hex !== 'string' || !/^#[\da-f]{6}$/i.test( message.hex ) ) {
          throw new AppError( 'invalidHex' );
        }
        const hex = message.hex.toUpperCase();
        if (
          palette.colors.some(
            ( color ) => color.type !== 'gradient' && color.hex.toUpperCase() === hex
          )
        )
          return palette;
        palette.colors.push( { id: makeId(), hex } );
      } else if ( message.type === findCorrectMassageType( SAVEGRADIENT ) ) {
        const gradient = normalizeGradient( message.gradient );
        if ( message.gradient.id !== undefined ) {
          const index = palette.colors.findIndex(
            ( item ) => item.id === message.gradient.id && item.type === 'gradient'
          );
          if ( index < 0 ) throw new AppError( 'gradientMissing' );
          palette.colors[index] = { id: message.gradient.id, ...gradient };
        } else {
          palette.colors.push( { id: makeId(), ...gradient } );
        }
      } else if ( message.type === findCorrectMassageType( REMOVECOLOR ) ) {
        if ( typeof message.id !== 'string' ) throw new AppError( 'missingColor' );
        palette.colors = palette.colors.filter( ( color ) => color.id !== message.id );
      } else {
        throw new AppError( 'unknownOperation' );
      }

      await storage.set( { [PALETTE_KEY]: palette } );
      return palette;
    } );
    queue = operation.catch( () => {} );
    return operation;
  };
}

export async function sendRequest( message ) {
  if ( !globalThis.chrome?.runtime?.id ) {
    throw new AppError( 'extensionRequired' );
  }
  let response;
  try {
    response = await chrome.runtime.sendMessage( message );
  } catch {
    throw new AppError( 'extensionUnavailable' );
  }
  if ( !response?.ok ) throw new AppError( response?.error || 'extensionUnavailable' );
  return response.value;
}

export const getPalette = () => sendRequest( { type: findCorrectMassageType( GETPALETTE ) } );
export const addColor = ( hex ) => sendRequest( { type: findCorrectMassageType( ADDCOLOR ), hex } );
export const removeColor = ( id ) => sendRequest( { type: findCorrectMassageType( REMOVECOLOR ), id } );
export const saveGradient = ( gradient ) => sendRequest( { type: findCorrectMassageType( SAVEGRADIENT ), gradient } );
export async function openEditor( gradientId ) {
  if ( !globalThis.chrome?.runtime?.id ) throw new AppError( 'extensionRequired' );
  // In a side panel this is its owning window, not the worker's last focused window.
  const { id: windowId } = await chrome.windows.getCurrent();
  return sendRequest( { type: findCorrectMassageType( OPENEDITOR ), windowId, gradientId } );
}

export function subscribeToPalette( onChange, onError ) {
  if ( !globalThis.chrome?.storage?.onChanged ) return () => {};
  const listener = ( changes, area ) => {
    if ( area !== 'local' || !changes[PALETTE_KEY] ) return;
    const palette = changes[PALETTE_KEY].newValue ?? createEmptyPalette();
    if ( isPalette( palette ) ) onChange( palette );
    else onError( new AppError( 'invalidPalette' ) );
  };
  chrome.storage.onChanged.addListener( listener );
  return () => chrome.storage.onChanged.removeListener( listener );
}
