import { StorageAdapter } from '@/storage.js';
import { PaletteRepository } from '@/services/paletteRepository.js';
import { PaletteService } from '@/services/paletteService.js';
import { dispatchMessage } from '@/runtime/dispatchMessage.js';
import { createListener } from '@/runtime/createListener.js';
import { createOpenEditor } from '@/openEditorTab.js';
import { PanelController, registerPanelEvents } from '@/panelController.js';

const storage = new StorageAdapter( chrome.storage );
const paletteService = new PaletteService( new PaletteRepository( storage ) );
const panel = new PanelController( chrome );
const messageDependencies = {
  paletteService,
  openEditor: createOpenEditor( chrome, panel ),
};

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
chrome.runtime.onMessage.addListener(
  createListener( chrome.runtime.id, ( message, sender ) =>
    dispatchMessage( messageDependencies, message, sender )
  )
);
