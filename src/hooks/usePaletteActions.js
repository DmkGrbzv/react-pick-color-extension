import { useEffect, useRef, useState } from 'react';
import { addColor, removeColor } from '@/api/paletteClient.js';
import { openEditor } from '@/api/editorClient.js';
import { errorKey } from '@/errors.js';

export function usePaletteActions() {
  const [notice, setNotice] = useState( null );
  const [busy, setBusy] = useState( false );
  const [opening, setOpening] = useState( false );
  const operationRef = useRef( false );
  const supported = typeof window.EyeDropper === 'function';

  useEffect( () => {
    if ( !notice?.temporary ) return;
    const timeout = window.setTimeout( () => setNotice( null ), 3000 );
    return () => window.clearTimeout( timeout );
  }, [notice] );

  async function pickColor() {
    if ( operationRef.current ) return;
    if ( !supported ) {
      setNotice( { error: true, key: 'unsupported' } );
      return;
    }
    operationRef.current = true;
    setBusy( true );
    setNotice( null );
    try {
      const result = await new window.EyeDropper().open();
      await addColor( result.sRGBHex );
      setNotice( { key: 'colorSaved', values: { hex: result.sRGBHex.toUpperCase() } } );
    } catch ( reason ) {
      if ( reason.name !== 'AbortError' ) {
        setNotice( { error: true, key: errorKey( reason, 'pickFailed' ) } );
      }
    } finally {
      operationRef.current = false;
      setBusy( false );
    }
  }

  async function copy( hex, css = false ) {
    try {
      await navigator.clipboard.writeText( hex );
      setNotice( {
        temporary: true,
        key: css ? 'gradient.cssCopied' : 'colorCopied',
        values: { hex },
      } );
    } catch {
      setNotice( { error: true, key: 'gradient.copyFailed' } );
    }
  }

  async function remove( id ) {
    if ( operationRef.current ) return;
    operationRef.current = true;
    setBusy( true );
    setNotice( null );
    try {
      await removeColor( id );
      setNotice( { key: 'gradient.itemRemoved' } );
    } catch ( reason ) {
      setNotice( { error: true, key: errorKey( reason, 'removeFailed' ) } );
    } finally {
      operationRef.current = false;
      setBusy( false );
    }
  }

  async function showEditor( gradientId ) {
    setOpening( true );
    setNotice( null );
    try {
      await openEditor( gradientId );
    } catch ( reason ) {
      setNotice( { error: true, key: errorKey( reason, 'editorFailed' ) } );
    } finally {
      setOpening( false );
    }
  }

  return { notice, busy, opening, supported, pickColor, copy, remove, showEditor };
}
