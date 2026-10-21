import { OPEN_EDITOR, findCorrectMessageType } from '@/extension/messaging/messageTypes.js';
import { sendRequest, requireExtension } from '@/extension/messaging/sendRequest.js';

export async function openEditor( gradientId, view ) {
  requireExtension();
  // Resolve the side panel's owning window before sending a request to the worker.
  const { id: windowId } = await chrome.windows.getCurrent();
  return sendRequest( { type: findCorrectMessageType( OPEN_EDITOR ), windowId, gradientId,
    ...( view === undefined ? {} : { view } ),
  } );
}
