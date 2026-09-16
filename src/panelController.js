export function isEditorTab( tab, editorUrl ) {
  return ( tab.pendingUrl || tab.url )?.split( /[?#]/ )[0] === editorUrl;
}

// This queue only orders API calls. Chrome owns panel visibility and tab options.
export function createPanelController( api ) {
  const editorUrl = api.runtime.getURL( 'editor.html' );
  const pending = new Map();

  function sync( tabId ) {
    let entry = pending.get( tabId );
    if ( !entry ) {
      entry = { removed: false, promise: Promise.resolve() };
      pending.set( tabId, entry );
    }
    const operation = entry.promise
      .catch( () => {} )
      .then( async () => {
        if ( entry.removed ) return;
        const tab = await api.tabs.get( tabId );
        if ( entry.removed ) return;
        const enabled = !isEditorTab( tab, editorUrl );
        const options = await api.sidePanel.getOptions( { tabId } );
        if ( entry.removed ) return;
        if (
          options.enabled !== enabled ||
          options.tabId !== tabId ||
          ( enabled && options.path !== 'sidepanel.html' )
        ) {
          await api.sidePanel.setOptions( {
            tabId,
            enabled,
            ...( enabled ? { path: 'sidepanel.html' } : {} ),
          } );
        }
        if ( entry.removed ) return;
        // Disabled actions cannot invoke the automatic panel behavior in the editor.
        if ( enabled ) await api.action.enable( tabId );
        else await api.action.disable( tabId );
      } )
      .catch( ( error ) => {
        if ( !entry.removed ) throw error;
      } );
    entry.promise = operation;
    void operation
      .finally( () => {
        if ( pending.get( tabId ) === entry && entry.promise === operation ) pending.delete( tabId );
      } )
      .catch( () => {} );
    return operation;
  }

  function forget( tabId ) {
    const entry = pending.get( tabId );
    if ( entry ) entry.removed = true;
    pending.delete( tabId );
    // Chrome removes tab-scoped settings itself. Never close another tab's panel.
  }

  async function initialize() {
    // No global panel: each site's panel has independent native open/closed state.
    await api.sidePanel.setOptions( { enabled: false } );
    await api.sidePanel.setPanelBehavior( { openPanelOnActionClick: true } );
    const tabs = await api.tabs.query( {} );
    await Promise.all( tabs.map( ( tab ) => sync( tab.id ) ) );
  }

  return { sync, forget, initialize };
}

export function registerPanelEvents( api, panel, onError = console.error ) {
  const sync = ( tabId ) => {
    void panel.sync( tabId ).catch( onError );
  };
  api.tabs.onCreated.addListener( ( tab ) => sync( tab.id ) );
  api.tabs.onUpdated.addListener( ( tabId, change ) => {
    if ( change.url !== undefined || change.status ) sync( tabId );
  } );
  api.tabs.onActivated.addListener( ( { tabId } ) => sync( tabId ) );
  api.tabs.onRemoved.addListener( ( tabId ) => panel.forget( tabId ) );
  api.tabs.onReplaced.addListener( ( addedId, removedId ) => {
    panel.forget( removedId );
    sync( addedId );
  } );
}
