import { useLayoutEffect, useRef, useState } from 'react';

export function usePrintPreviewWidth() {
  const container = useRef( null );
  const [width, setWidth] = useState( null );

  useLayoutEffect( () => {
    if ( typeof ResizeObserver !== 'function' ) return;
    const observer = new ResizeObserver( ( entries ) => {
      setWidth( entries[0].contentRect.width );
    } );
    observer.observe( container.current );
    return () => observer.disconnect();
  }, [] );

  return { container, width };
}
