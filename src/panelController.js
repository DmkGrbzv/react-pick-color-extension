export function isEditorTab( tab, editorUrl ) {
  return ( tab.pendingUrl || tab.url )?.split( /[?#]/ )[0] === editorUrl;
}

// Wait for this tab's previous request, then apply its current Chrome settings.
async function configureTabPanel( api, tabId, tabState, disabledUrls, previousOperation ) {
  try {
    await previousOperation;
  } catch {
    // The previous caller receives its error; this request can still retry.
  }

  // A tab can close during any Chrome call. Stop before issuing the next one.
  if ( tabState.removed ) return;
  const tab = await api.tabs.get( tabId );
  if ( tabState.removed ) return;
  const enabled = !disabledUrls.some( ( url ) => isEditorTab( tab, url ) );
  const currentOptions = await api.sidePanel.getOptions( { tabId } );
  if ( tabState.removed ) return;

  const needsUpdate =
    currentOptions.enabled !== enabled ||
    currentOptions.tabId !== tabId ||
    ( enabled && currentOptions.path !== 'sidepanel.html' );
  if ( needsUpdate ) {
    await api.sidePanel.setOptions( {
      tabId,
      enabled,
      ...( enabled ? { path: 'sidepanel.html' } : {} ),
    } );
  }
  if ( tabState.removed ) return;
  // The extension icon must not open a duplicate panel on its own pages.
  if ( enabled ) await api.action.enable( tabId );
  else await api.action.disable( tabId );
}

// Only orders requests. Chrome keeps each tab's native open/closed panel state.
export function createPanelController( api ) {
  const disabledUrls = ['editor.html', 'print.html'].map( ( page ) => api.runtime.getURL( page ) );
  const pendingTabs = new Map();

  async function sync( tabId ) {
    const tabState = pendingTabs.get( tabId ) || { removed: false, operation: undefined };
    pendingTabs.set( tabId, tabState );
    const operation = configureTabPanel( api, tabId, tabState, disabledUrls, tabState.operation );
    tabState.operation = operation;
    try {
      await operation;
    } catch ( error ) {
      // Closing the tab cancels its requests; other failures go to the caller.
      if ( !tabState.removed ) throw error;
    } finally {
      const isLatestRequest =
        pendingTabs.get( tabId ) === tabState && tabState.operation === operation;
      if ( isLatestRequest ) pendingTabs.delete( tabId );
    }
  }

  function forget( tabId ) {
    const tabState = pendingTabs.get( tabId );
    if ( tabState ) tabState.removed = true;
    pendingTabs.delete( tabId );
    // Chrome removes the tab's settings. Other tabs remain untouched.
  }

  async function initialize() {
    await api.sidePanel.setOptions( { enabled: false } );
    await api.sidePanel.setPanelBehavior( { openPanelOnActionClick: true } );
    const tabs = await api.tabs.query( {} );
    await Promise.all( tabs.map( ( tab ) => sync( tab.id ) ) );
  }

  return { sync, forget, initialize };
}

export function registerPanelEvents( api, panel, onError = console.error ) {
  const sync = async ( tabId ) => {
    try {
      await panel.sync( tabId );
    } catch ( error ) {
      onError( error );
    }
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
