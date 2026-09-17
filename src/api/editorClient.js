import { OPEN_EDITOR, findCorrectMessageType } from '@/messageTypes.js';
import { sendRequest, requireExtension } from '@/runtime/sendRequest.js';

export async function openEditor( gradientId ) {
  requireExtension();
  // Resolve the side panel's owning window before sending a request to the worker.
  const { id: windowId } = await chrome.windows.getCurrent();
  return sendRequest( { type: findCorrectMessageType( OPEN_EDITOR ), windowId, gradientId } );
}
