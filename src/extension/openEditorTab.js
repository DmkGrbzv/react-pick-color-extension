import { EXTENSION_PAGES } from '@/constants/extensionPages.js';
import { matchesTabUrl } from '@/utils/tabUrl.js';
import { APP_VIEWS } from '@/routes/appRoutes.js';

async function activateEditorTab( api, panel, request, previousOperation ) {
  const { windowId, gradientId, view } = request;
  try {
    await previousOperation;
  } catch {
    // A failed earlier request must not block opening the editor.
  }

  const editorUrl = api.runtime.getURL( EXTENSION_PAGES.EDITOR );
  const tabs = await api.tabs.query( { windowId } );
  const pages = [EXTENSION_PAGES.EDITOR, EXTENSION_PAGES.LIBRARY, EXTENSION_PAGES.PRINT]
    .map( ( page ) => api.runtime.getURL( page ) );
  const existingTab = tabs.find( ( tab ) => pages.some( ( url ) => matchesTabUrl( tab, url ) ) );
  const baseUrl = existingTab ? ( existingTab.pendingUrl || existingTab.url ).split( '#' )[0] : editorUrl;
  const params = typeof gradientId === 'string'
    ? { view: 'working', gradient: gradientId, request: crypto.randomUUID() }
    : view ? { view, request: crypto.randomUUID() } : null;
  const targetUrl = params ? baseUrl + '#' + new URLSearchParams( params ) : baseUrl;
  const editorTab =
    existingTab || ( await api.tabs.create( { url: targetUrl, windowId, active: false } ) );
  await panel.sync( editorTab.id );
  await api.tabs.update( editorTab.id, {
    active: true,
    ...( existingTab && params ? { url: targetUrl } : {} ),
  } );
  return editorTab.id;
}

// This function owns one opening operation, with an independent queue for each window.
export function createOpenEditor( api, panel ) {
  const pendingByWindow = new Map();
  return async function openEditor( windowId, gradientId, view ) {
    if ( !Number.isInteger( windowId ) || windowId < 0 ) {
      throw new Error( 'A source window is required' );
    }
    if ( view !== undefined && !APP_VIEWS.includes( view ) ) throw new Error( 'Unknown app view' );
    // One queue per window prevents duplicate tabs during rapid clicks.
    const previousOperation = pendingByWindow.get( windowId );
    const operation = activateEditorTab( api, panel, { windowId, gradientId, view }, previousOperation );
    pendingByWindow.set( windowId, operation );
    try {
      return await operation;
    } finally {
      if ( pendingByWindow.get( windowId ) === operation ) pendingByWindow.delete( windowId );
    }
  };
}
