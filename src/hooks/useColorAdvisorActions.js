import { useEffect, useRef, useState } from 'react';
import { addColor } from '@/api/paletteClient.js';
import { colorValues } from '@/utils/colorConversion.js';
import { errorKey } from '@/errors.js';
import { ERROR_CODES } from '@/constants/errorCodes.js';

export function useColorAdvisorActions() {
  const [saving, setSaving] = useState( false );
  const [notice, setNotice] = useState( null );
  const savingRef = useRef( false );
  useEffect( () => {
    if ( !notice || notice.error ) return;
    const timer = window.setTimeout( () => setNotice( null ), 3000 );
    return () => window.clearTimeout( timer );
  }, [notice] );

  async function add( hex ) {
    if ( savingRef.current ) return;
    savingRef.current = true;
    setSaving( true );
    setNotice( null );
    try {
      await addColor( hex );
      setNotice( { key: 'advisor.added', values: { hex } } );
    } catch ( error ) {
      setNotice( { error: true, key: errorKey( error, ERROR_CODES.STORAGE_FAILURE ) } );
    } finally {
      savingRef.current = false;
      setSaving( false );
    }
  }

  async function copy( hex, format ) {
    const value = colorValues( hex )[format];
    try {
      await navigator.clipboard.writeText( value );
      setNotice( { key: 'colorCopied', values: { hex: value } } );
    } catch {
      setNotice( { error: true, key: errorKey( null, ERROR_CODES.COPY_FAILED ) } );
    }
  }
  return { saving, notice, add, copy };
}
