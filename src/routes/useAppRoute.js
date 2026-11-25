import { useCallback, useEffect, useState } from 'react';
import { appViewHash, readAppView } from '@/routes/appRoutes.js';

export function useAppRoute( initialPage = 'working', allowLibrary = true ) {
  const available = useCallback( page => page === 'library' && !allowLibrary ? 'working' : page, [allowLibrary] );
  const [route, setRoute] = useState( () => {
    const page = available( readAppView( window.location.hash, initialPage ) );
    return { page, visited: [page] };
  } );
  const update = useCallback( ( requested ) => {
    const page = available( requested );
    setRoute( ( previous ) => ( {
      page,
      visited: previous.visited.includes( page ) ? previous.visited : [...previous.visited, page],
    } ) );
  }, [available] );
  useEffect( () => {
    const changed = () => {
      const requested = readAppView( window.location.hash, initialPage );
      const page = available( requested );
      if ( page !== requested ) window.history.replaceState( null, '', appViewHash( page ) );
      update( page );
    };
    changed();
    window.addEventListener( 'hashchange', changed );
    window.addEventListener( 'popstate', changed );
    return () => {
      window.removeEventListener( 'hashchange', changed );
      window.removeEventListener( 'popstate', changed );
    };
  }, [initialPage, update, available] );
  const navigate = useCallback( ( requested ) => {
    const page = available( requested );
    const hash = appViewHash( page );
    if ( window.location.hash !== hash ) window.history.pushState( null, '', hash );
    update( page );
  }, [update, available] );
  return { ...route, navigate };
}
