import { useEffect, useState } from 'react';
import { getPalette, subscribeToPalette } from './storage';
import { createPaletteSubscription } from './paletteSubscription';

export function usePalette() {
  const [palette, setPalette] = useState( null );
  const [error, setError] = useState( '' );
  const [attempt, setAttempt] = useState( 0 );

  useEffect( () => {
    const subscription = createPaletteSubscription( {
      read: getPalette,
      subscribe: subscribeToPalette,
      onValue: ( value ) => {
        setPalette( value );
        setError( '' );
      },
      onError: ( reason ) => {
        setPalette( null );
        setError( reason );
      },
    } );
    const refresh = () => {
      void subscription.refresh();
    };
    const onVisibility = () => {
      if ( document.visibilityState === 'visible' ) refresh();
    };
    document.addEventListener( 'visibilitychange', onVisibility );
    window.addEventListener( 'pageshow', refresh );
    window.addEventListener( 'focus', refresh );
    refresh();
    return () => {
      subscription.dispose();
      document.removeEventListener( 'visibilitychange', onVisibility );
      window.removeEventListener( 'pageshow', refresh );
      window.removeEventListener( 'focus', refresh );
    };
  }, [attempt] );

  return { palette, error, retry: () => setAttempt( ( value ) => value + 1 ) };
}
