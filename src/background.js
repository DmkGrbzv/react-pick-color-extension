import { createStorageAdapter } from '@/storage.js';
import { createPaletteRepository } from '@/services/paletteRepository.js';
import { createPaletteService } from '@/services/paletteService.js';
import { createRouter } from '@/runtime/createRouter.js';
import { createListener } from '@/runtime/createListener.js';
import { createEditorOpener } from '@/editorTab.js';
import { createPanelController, registerPanelEvents } from '@/panelController.js';

const storage = createStorageAdapter( chrome.storage );
const paletteService = createPaletteService( createPaletteRepository( storage ) );
const panel = createPanelController( chrome );
const dispatch = createRouter( { paletteService, openEditor: createEditorOpener( chrome, panel ) } );

// Register listeners synchronously and reconcile tab settings on each worker start.
registerPanelEvents( chrome, panel );
async function initializePanel() {
  try {
    await panel.initialize();
  } catch ( error ) {
    console.error( error );
  }
}
void initializePanel();
chrome.runtime.onMessage.addListener( createListener( chrome.runtime.id, dispatch ) );
