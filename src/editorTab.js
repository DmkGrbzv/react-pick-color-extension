import { isEditorTab } from '@/panelController.js';

export function createEditorOpener( api, panel ) {
  const pendingByWindow = new Map();
  return async function openEditor( windowId, gradientId ) {
    if ( !Number.isInteger( windowId ) || windowId < 0 ) {
      throw new Error( 'A source window is required' );
    }
    // Serialize requests, including different edit targets, without creating duplicate tabs.
    const previous = pendingByWindow.get( windowId );
    async function run() {
      try {
        await previous;
      } catch {
        // A failed earlier request must not block opening the editor.
      }
      try {
        const url = api.runtime.getURL( 'editor.html' );
        const target =
          typeof gradientId === 'string'
            ? url +
              '#' +
              new URLSearchParams( { gradient: gradientId, request: crypto.randomUUID() } ).toString()
            : url;
        const tabs = await api.tabs.query( { windowId } );
        const existing = tabs.find( ( tab ) => isEditorTab( tab, url ) );
        const tab = existing || ( await api.tabs.create( { url: target, windowId, active: false } ) );
        await panel.sync( tab.id );
        await api.tabs.update( tab.id, {
          active: true,
          ...( existing && gradientId ? { url: target } : {} ),
        } );
        return tab.id;
      } finally {
        if ( pendingByWindow.get( windowId ) === operation ) pendingByWindow.delete( windowId );
      }
    }
    const operation = run();
    pendingByWindow.set( windowId, operation );
    return operation;
  };
}
