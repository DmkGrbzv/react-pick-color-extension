import {
  OPENEDITOR,
  findCorrectMassageType,
  isMessageType,
} from './messageTypes.js';
import { createPaletteService } from './storage';
import { createEditorOpener } from './editorTab';
import { createPanelController, registerPanelEvents } from './panelController';

const execute = createPaletteService( chrome.storage.local );
const panel = createPanelController( chrome );
const openEditor = createEditorOpener( chrome, panel );

// Register listeners synchronously, then reconcile existing/restored tabs on
// every worker start. No remembered visibility flags or automatic open() calls.
registerPanelEvents( chrome, panel );
void panel.initialize().catch( console.error );

chrome.runtime.onMessage.addListener( ( message, sender, sendResponse ) => {
  if ( sender.id !== chrome.runtime.id ) return false;
  if (
    !isMessageType( message?.type )
  ) {
    return false;
  }
  const operation =
    message.type === findCorrectMassageType( OPENEDITOR )
      ? openEditor( sender.tab?.windowId ?? message.windowId, message.gradientId )
      : execute( message );
  operation.then(
    ( value ) => sendResponse( { ok: true, value } ),
    ( error ) =>
      sendResponse( {
        ok: false,
        error: error.code || ( message.type === findCorrectMassageType( OPENEDITOR ) ? 'editorFailed' : 'storageFailure' ),
      } )
  );
  return true;
} );
