import { useEffect, useState, useSyncExternalStore } from 'react';
import { SavedPalettesModel } from '@/features/saved-palettes/models/savedPalettesModel.js';
import { subscribeToAccountEvents } from '@/features/auth/adapters/accountEvents.js';

export function useSavedPalettes( { loadLibrary = true, enabled = true } = {} ) {
  const [model] = useState( () => new SavedPalettesModel( undefined, { loadLibrary } ) );
  const state = useSyncExternalStore( model.subscribe, model.getSnapshot );
  useEffect( () => { model.setLibraryActive( loadLibrary ); }, [model, loadLibrary] );
  useEffect( () => {
    if ( !enabled ) return;
    const refresh = () => { void model.refresh(); };
    model.start();
    const unsubscribe = subscribeToAccountEvents( {
      onSessionChange: () => model.sessionChanged(), onPendingChange: refresh,
    } );
    window.addEventListener( 'focus', refresh );
    return () => {
      model.stop();
      unsubscribe();
      window.removeEventListener( 'focus', refresh );
    };
  }, [model, enabled] );
  return { state, model };
}
