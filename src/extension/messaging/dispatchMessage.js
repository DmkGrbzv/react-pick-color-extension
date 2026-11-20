import { ERROR_CODES } from '@/constants/errorCodes.js';
import {
  GET_PALETTE,
  ADD_COLOR,
  REMOVE_COLOR,
  CLEAR_PALETTE,
  MOVE_ITEM_FIRST,
  SAVE_GRADIENT,
  OPEN_EDITOR,
  findCorrectMessageType,
} from '@/extension/messaging/messageTypes.js';
import { AppError } from '@/utils/errors.js';
import { dispatchLibraryMessage } from '@/extension/messaging/dispatchLibraryMessage.js';

// Translate transport commands into application operations. No state or persistence here.
export async function dispatchMessage( { paletteService, openEditor, library, backup }, message, sender = {} ) {
  if ( message?.type?.startsWith( 'backup:' ) ) {
    switch ( message.type ) {
      case 'backup:read': return backup.read();
      case 'backup:create': return backup.create();
      case 'backup:remove': return backup.remove();
      case 'backup:open': return backup.open( message.createdAt, message.index, message.expectedVersion );
      default: throw new AppError( 'unknownOperation' );
    }
  }
  if ( message?.type?.startsWith( 'cloud:' ) ) return dispatchLibraryMessage( library, message );
  switch ( message?.type ) {
    case findCorrectMessageType( GET_PALETTE ):
      return paletteService.getPalette();
    case findCorrectMessageType( ADD_COLOR ):
      return paletteService.addColor( message.hex );
    case findCorrectMessageType( MOVE_ITEM_FIRST ):
      return paletteService.moveItemFirst( message.id );
    case findCorrectMessageType( REMOVE_COLOR ):
      return paletteService.removeItem( message.id );
    case findCorrectMessageType( CLEAR_PALETTE ):
      return paletteService.clearPalette( message.expectedVersion );
    case findCorrectMessageType( SAVE_GRADIENT ):
      return paletteService.saveGradient( message.gradient );
    case findCorrectMessageType( OPEN_EDITOR ):
      return openEditor( sender.tab?.windowId ?? message.windowId, message.gradientId,
        ...( message.view === undefined ? [] : [message.view] ) );
    default:
      throw new AppError( ERROR_CODES.UNKNOWN_OPERATION );
  }
}
