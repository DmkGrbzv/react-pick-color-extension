import { useCallback, useEffect, useState } from 'react';
import { appViewHash, readAppView } from '@/navigation/appRoutes.js';

export function useAppRoute( initialPage = 'working' ) {
  const [route, setRoute] = useState( () => {
    const page = readAppView( window.location.hash, initialPage );
    return { page, visited: [page] };
  } );
  const update = useCallback( ( page ) => {
    setRoute( ( previous ) => ( {
      page,
      visited: previous.visited.includes( page ) ? previous.visited : [...previous.visited, page],
    } ) );
  }, [] );
  useEffect( () => {
    const changed = () => update( readAppView( window.location.hash, initialPage ) );
    window.addEventListener( 'hashchange', changed );
    window.addEventListener( 'popstate', changed );
    return () => {
      window.removeEventListener( 'hashchange', changed );
      window.removeEventListener( 'popstate', changed );
    };
  }, [initialPage, update] );
  const navigate = useCallback( ( page ) => {
    const hash = appViewHash( page );
    if ( window.location.hash !== hash ) window.history.pushState( null, '', hash );
    update( page );
  }, [update] );
  return { ...route, navigate };
}
