import { ERROR_CODES } from '@/constants/errorCodes.js';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotice } from '@/hooks/useNotice.js';
import { addColor, clearPalette, removeColor } from '@/extension/clients/paletteClient.js';
import { openEditor } from '@/extension/clients/editorClient.js';
import { errorKey } from '@/utils/errors.js';
import { paletteVersion } from '@/utils/paletteSnapshot.js';

export function usePaletteActions() {
  const { t } = useTranslation();
  const [notice, setNotice] = useNotice();
  const [busy, setBusy] = useState( false );
  const [opening, setOpening] = useState( false );
  const operationRef = useRef( false );
  const supported = typeof window.EyeDropper === 'function';

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
        setNotice( { error: true, key: errorKey( reason, ERROR_CODES.PICK_FAILED ) } );
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
      setNotice( { error: true, key: errorKey( reason, ERROR_CODES.REMOVE_FAILED ) } );
    } finally {
      operationRef.current = false;
      setBusy( false );
    }
  }

  async function clear( palette ) {
    if ( operationRef.current || !palette?.colors.length ) return;
    const expectedVersion = paletteVersion( palette );
    if ( !window.confirm( t( 'paletteClear.confirm' ) ) ) return;
    operationRef.current = true;
    setBusy( true );
    setNotice( null );
    try {
      await clearPalette( expectedVersion );
      setNotice( { key: 'paletteClear.cleared' } );
    } catch ( reason ) {
      setNotice( { error: true, key: reason.code === 'paletteChanged'
        ? 'paletteClear.changed' : errorKey( reason, ERROR_CODES.STORAGE_FAILURE ) } );
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
      setNotice( { error: true, key: errorKey( reason, ERROR_CODES.EDITOR_FAILED ) } );
    } finally {
      setOpening( false );
    }
  }

  return { notice, busy, opening, supported, pickColor, copy, remove, clear, showEditor };
}
