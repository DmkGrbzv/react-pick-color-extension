import { useEffect, useState } from 'react';

const NOTICE_DURATION_MS = 12_000;

export function useNotice( initialNotice = null ) {
  const [notice, setNotice] = useState( initialNotice );

  useEffect( () => {
    if ( !notice || notice.error ) return;
    const timer = window.setTimeout( () => {
      // An old timer must not clear a newer message.
      setNotice( ( current ) => current === notice ? null : current );
    }, NOTICE_DURATION_MS );
    return () => window.clearTimeout( timer );
  }, [notice] );

  return [notice, setNotice];
}
