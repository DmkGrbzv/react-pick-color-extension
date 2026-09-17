import { OPEN_EDITOR, findCorrectMessageType, isMessageType } from '@/messageTypes.js';
import { AppError } from '@/errors.js';

// The worker boundary serializes failures; storage/services never convert them to success.
export function createListener( extensionId, dispatch ) {
  return ( message, sender, sendResponse ) => {
    if ( sender.id !== extensionId || !isMessageType( message?.type ) ) return false;
    async function respond() {
      let response;
      try {
        const value = await dispatch( message, sender );
        response = { ok: true, value };
      } catch ( error ) {
        response = {
          ok: false,
          error:
            error instanceof AppError
              ? error.code
              : message.type === findCorrectMessageType( OPEN_EDITOR )
                ? 'editorFailed'
                : 'storageFailure',
          details: error instanceof Error ? error.message : String( error ),
        };
      }
      sendResponse( response );
    }
    void respond();
    // Chrome requires a synchronous true to keep the response channel open.
    return true;
  };
}
