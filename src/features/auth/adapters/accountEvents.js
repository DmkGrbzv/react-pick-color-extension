import { SESSION_KEY, PENDING_KEY } from '../constants/sessionKeys.js';

// Only notifications cross into UI; credentials never do.
export function subscribeToAccountEvents( { onSessionChange, onPendingChange }, storage = chrome.storage ) {
  const changed = ( changes, area ) => {
    if ( area === 'local' && Object.hasOwn( changes, SESSION_KEY ) ) onSessionChange();
    if ( area === 'session' && Object.hasOwn( changes, PENDING_KEY ) ) onPendingChange();
  };
  storage.onChanged.addListener( changed );
  return () => storage.onChanged.removeListener( changed );
}
