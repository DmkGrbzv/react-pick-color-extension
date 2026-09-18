import { matchesTabUrl } from '@/utils/tabUrl.js';

// Only orders requests. Chrome keeps each tab's native open/closed panel state.
export class PanelController {
  #api;
  #disabledUrls;
  #pendingTabs = new Map();
  constructor( api ) {
    this.#api = api;
    this.#disabledUrls = ['editor.html', 'print.html'].map( ( page ) => api.runtime.getURL( page ) );
  }

  async #configureTab( tabId, tabState, previousOperation ) {
    try {
      await previousOperation;
    } catch {
      // The previous caller receives its error; this request can still retry.
    }

    // A tab can close during any Chrome call. Stop before issuing the next one.
    if ( tabState.removed ) return;
    const tab = await this.#api.tabs.get( tabId );
    if ( tabState.removed ) return;
    const enabled = !this.#disabledUrls.some( ( url ) => matchesTabUrl( tab, url ) );
    const currentOptions = await this.#api.sidePanel.getOptions( { tabId } );
    if ( tabState.removed ) return;

    const needsUpdate =
      currentOptions.enabled !== enabled ||
      currentOptions.tabId !== tabId ||
      ( enabled && currentOptions.path !== 'sidepanel.html' );
    if ( needsUpdate ) {
      await this.#api.sidePanel.setOptions( {
        tabId,
        enabled,
        ...( enabled ? { path: 'sidepanel.html' } : {} ),
      } );
    }
    if ( tabState.removed ) return;
    // The extension icon must not open a duplicate panel on its own pages.
    if ( enabled ) await this.#api.action.enable( tabId );
    else await this.#api.action.disable( tabId );
  }

  async sync( tabId ) {
    const tabState = this.#pendingTabs.get( tabId ) || { removed: false, operation: undefined };
    this.#pendingTabs.set( tabId, tabState );
    const operation = this.#configureTab( tabId, tabState, tabState.operation );
    tabState.operation = operation;
    try {
      await operation;
    } catch ( error ) {
      // Closing the tab cancels its requests; other failures go to the caller.
      if ( !tabState.removed ) throw error;
    } finally {
      const isLatestRequest =
        this.#pendingTabs.get( tabId ) === tabState && tabState.operation === operation;
      if ( isLatestRequest ) this.#pendingTabs.delete( tabId );
    }
  }

  forget( tabId ) {
    const tabState = this.#pendingTabs.get( tabId );
    if ( tabState ) tabState.removed = true;
    this.#pendingTabs.delete( tabId );
    // Chrome removes the tab's settings. Other tabs remain untouched.
  }

  async initialize() {
    await this.#api.sidePanel.setOptions( { enabled: false } );
    await this.#api.sidePanel.setPanelBehavior( { openPanelOnActionClick: true } );
    const tabs = await this.#api.tabs.query( {} );
    await Promise.all( tabs.map( ( tab ) => this.sync( tab.id ) ) );
  }
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
