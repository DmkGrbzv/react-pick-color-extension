import { useRef, useState } from 'react';
import { useNotice } from '@/hooks/useNotice.js';
import { addColor, addColors } from '@/extension/clients/paletteClient.js';
import { colorValues } from '@/utils/colorConversion.js';
import { errorKey } from '@/utils/errors.js';
import { ERROR_CODES } from '@/constants/errorCodes.js';

export function useColorAdvisorActions() {
  const [saving, setSaving] = useState( false );
  const [notice, setNotice] = useNotice();
  const savingRef = useRef( false );

  async function add( hex ) {
    return save( () => addColor( hex ), { key: 'advisor.added', values: { hex } } );
  }

  async function addAll( hexes ) {
    return save( () => addColors( hexes ), { key: 'advisor.historical.addedAll' } );
  }

  async function save( operation, success ) {
    if ( savingRef.current ) return;
    savingRef.current = true;
    setSaving( true );
    setNotice( null );
    try {
      await operation();
      setNotice( success );
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
  return { saving, notice, add, addAll, copy };
}
