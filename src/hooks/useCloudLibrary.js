import { useEffect, useState, useSyncExternalStore } from 'react';
import { CloudLibraryModel } from '@/cloud/libraryModel.js';

export function useCloudLibrary( { loadLibrary = true, enabled = true } = {} ) {
  const [model] = useState( () => new CloudLibraryModel( undefined, { loadLibrary } ) );
  const state = useSyncExternalStore( model.subscribe, model.getSnapshot );
  useEffect( () => { model.setLibraryActive( loadLibrary ); }, [model, loadLibrary] );
  useEffect( () => {
    if ( !enabled ) return;
    const changed = ( changes, area ) => {
      if ( area === 'local' && Object.hasOwn( changes, 'cloudSession' ) ) model.sessionChanged();
      if ( area === 'session' && Object.hasOwn( changes, 'cloudPendingSave' ) ) void model.refresh();
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
