import { StorageAdapter } from '@/storage.js';
import { PaletteRepository } from '@/services/paletteRepository.js';
import { PaletteService } from '@/services/paletteService.js';
import { dispatchMessage } from '@/runtime/dispatchMessage.js';
import { createListener } from '@/runtime/createListener.js';
import { createOpenEditor } from '@/openEditorTab.js';
import { PanelController, registerPanelEvents } from '@/panelController.js';
import { CloudHttpClient } from '@/cloud/httpClient.js';
import { CloudSessionStore } from '@/cloud/sessionStore.js';
import { BrowserSignIn } from '@/cloud/browserSignIn.js';
import { CloudService } from '@/cloud/cloudService.js';
import { cloudApiUrl } from '@/cloud/config.js';

const storage = new StorageAdapter( chrome.storage );
const paletteService = new PaletteService( new PaletteRepository( storage ) );
const panel = new PanelController( chrome );
const http = cloudApiUrl ? new CloudHttpClient( cloudApiUrl ) : null;
const sessions = http ? new CloudSessionStore( chrome.storage ) : null;
const cloud = http ? new CloudService( {
  http,
  store: sessions,
  login: new BrowserSignIn( { api: chrome, http } ),
  palette: paletteService,
} ) : null;
const messageDependencies = {
  paletteService,
  cloud,
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
    dispatchMessage( messageDependencies, message, sender ), chrome.runtime.getURL( '/' )
  )
);
