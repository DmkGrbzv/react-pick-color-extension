import { StorageAdapter } from '@/services/storage.js';
import { PaletteRepository } from '@/features/palette/services/paletteRepository.js';
import { PaletteService } from '@/features/palette/services/paletteService.js';
import { dispatchMessage } from '@/extension/messaging/dispatchMessage.js';
import { createListener } from '@/extension/messaging/createListener.js';
import { createOpenEditor } from '@/extension/openEditorTab.js';
import { PanelController, registerPanelEvents } from '@/extension/panelController.js';
import { ApiClient } from '@/api/client.js';
import { ChromeSessionStorage } from '@/features/auth/adapters/chromeSessionStorage.js';
import { SessionStore } from '@/features/auth/services/sessionStore.js';
import { BrowserSignIn } from '@/features/auth/services/browserSignIn.js';
import { SavedPaletteService } from '@/features/saved-palettes/services/savedPaletteService.js';
import { DeviceBackupService } from '@/features/saved-palettes/services/deviceBackupService.js';
import { SESSION_KEY, EPOCH_KEY } from '@/features/auth/constants/sessionKeys.js';
import { apiUrl } from '@/api/config.js';

const storage = new StorageAdapter( chrome.storage );
const paletteService = new PaletteService( new PaletteRepository( storage ) );
const panel = new PanelController( chrome );
const http = apiUrl ? new ApiClient( apiUrl ) : null;
const sessionStorage = new ChromeSessionStorage( chrome.storage );
void sessionStorage.initialize().catch( () => { console.error( 'Trusted storage initialization failed.' ); } );
const sessions = new SessionStore( sessionStorage );
const library = http ? new SavedPaletteService( {
  http,
  store: sessions,
  login: new BrowserSignIn( { api: chrome, http } ),
  palette: paletteService,
} ) : null;
const backup = new DeviceBackupService( { storage: sessionStorage, store: sessions, http, palette: paletteService } );
chrome.storage.onChanged.addListener( ( changes ) => {
  if ( Object.hasOwn( changes, SESSION_KEY ) || Object.hasOwn( changes, EPOCH_KEY ) ) backup.cancel();
} );
const messageDependencies = {
  backup,
  paletteService,
  library,
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
