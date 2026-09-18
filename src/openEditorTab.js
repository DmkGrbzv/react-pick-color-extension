import { matchesTabUrl } from '@/utils/tabUrl.js';

async function activateEditorTab( api, panel, windowId, gradientId, previousOperation ) {
  try {
    await previousOperation;
  } catch {
    // A failed earlier request must not block opening the editor.
  }

  const editorUrl = api.runtime.getURL( 'editor.html' );
  const targetUrl =
    typeof gradientId === 'string'
      ? editorUrl +
        '#' +
        new URLSearchParams( { gradient: gradientId, request: crypto.randomUUID() } )
      : editorUrl;
  const tabs = await api.tabs.query( { windowId } );
  const existingTab = tabs.find( ( tab ) => matchesTabUrl( tab, editorUrl ) );
  const editorTab =
    existingTab || ( await api.tabs.create( { url: targetUrl, windowId, active: false } ) );
  await panel.sync( editorTab.id );
  await api.tabs.update( editorTab.id, {
    active: true,
    ...( existingTab && gradientId ? { url: targetUrl } : {} ),
  } );
  return editorTab.id;
}

// This function owns one opening operation, with an independent queue for each window.
export function createOpenEditor( api, panel ) {
  const pendingByWindow = new Map();
  return async function openEditor( windowId, gradientId ) {
    if ( !Number.isInteger( windowId ) || windowId < 0 ) {
      throw new Error( 'A source window is required' );
    }
    // One queue per window prevents duplicate tabs during rapid clicks.
    const previousOperation = pendingByWindow.get( windowId );
    const operation = activateEditorTab( api, panel, windowId, gradientId, previousOperation );
    pendingByWindow.set( windowId, operation );
    try {
      return await operation;
    } finally {
      if ( pendingByWindow.get( windowId ) === operation ) pendingByWindow.delete( windowId );
    }
  };
}
