import {
  GET_PALETTE,
  ADD_COLOR,
  REMOVE_COLOR,
  SAVE_GRADIENT,
  OPEN_EDITOR,
  findCorrectMessageType,
} from '@/messageTypes.js';
import { AppError } from '@/errors.js';

export function createRouter( { paletteService, openEditor } ) {
  const handlers = new Map( [
    [findCorrectMessageType( GET_PALETTE ), () => paletteService.getPalette()],
    [findCorrectMessageType( ADD_COLOR ), ( message ) => paletteService.addColor( message.hex )],
    [findCorrectMessageType( REMOVE_COLOR ), ( message ) => paletteService.removeItem( message.id )],
    [
      findCorrectMessageType( SAVE_GRADIENT ),
      ( message ) => paletteService.saveGradient( message.gradient ),
    ],
    [
      findCorrectMessageType( OPEN_EDITOR ),
      ( message, sender ) => openEditor( sender.tab?.windowId ?? message.windowId, message.gradientId ),
    ],
  ] );

  return async function dispatch( message, sender = {} ) {
    const handler = handlers.get( message?.type );
    if ( !handler ) throw new AppError( 'unknownOperation' );
    return handler( message, sender );
  };
}
