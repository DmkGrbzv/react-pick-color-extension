import { useEffect, useState, useSyncExternalStore } from 'react';
import { SavedPalettesModel } from '@/features/saved-palettes/models/savedPalettesModel.js';
import { SESSION_KEY, PENDING_KEY } from '@/features/auth/constants/sessionKeys.js';

export function useSavedPalettes( { loadLibrary = true, enabled = true } = {} ) {
  const [model] = useState( () => new SavedPalettesModel( undefined, { loadLibrary } ) );
  const state = useSyncExternalStore( model.subscribe, model.getSnapshot );
  useEffect( () => { model.setLibraryActive( loadLibrary ); }, [model, loadLibrary] );
  useEffect( () => {
    if ( !enabled ) return;
    const changed = ( changes, area ) => {
      if ( area === 'local' && Object.hasOwn( changes, SESSION_KEY ) ) model.sessionChanged();
      if ( area === 'session' && Object.hasOwn( changes, PENDING_KEY ) ) void model.refresh();
    };
    const refresh = () => { void model.refresh(); };
    model.start();
    chrome.storage.onChanged.addListener( changed );
    window.addEventListener( 'focus', refresh );
    return () => {
      model.stop();
      chrome.storage.onChanged.removeListener( changed );
      window.removeEventListener( 'focus', refresh );
    };
  }, [model, enabled] );
  return { state, model };
}
