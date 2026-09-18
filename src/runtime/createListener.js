import { ERROR_CODES } from '@/constants/errorCodes.js';
import { OPEN_EDITOR, findCorrectMessageType, isMessageType } from '@/messageTypes.js';
import { AppError } from '@/errors.js';

// Errors become response data only at the worker boundary.
async function respondToMessage( dispatch, message, sender, sendResponse ) {
  let response;
  try {
    const value = await dispatch( message, sender );
    response = { ok: true, value };
  } catch ( error ) {
    const isEditorRequest = message.type === findCorrectMessageType( OPEN_EDITOR );
    const fallbackError = isEditorRequest ? ERROR_CODES.EDITOR_FAILED : ERROR_CODES.STORAGE_FAILURE;
    response = {
      ok: false,
      error: error instanceof AppError ? error.code : fallbackError,
      details: error instanceof Error ? error.message : String( error ),
    };
  }
  sendResponse( response );
}

export function createListener( extensionId, dispatch ) {
  return ( message, sender, sendResponse ) => {
    if ( sender.id !== extensionId || !isMessageType( message?.type ) ) return false;
    void respondToMessage( dispatch, message, sender, sendResponse );
    // Chrome requires a synchronous true to keep the response channel open.
    return true;
  };
}
