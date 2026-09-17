import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createGradientDraft,
  draftDirty,
  gradientFromDraft,
  updateGradientDraft,
} from '@/gradient.js';
import { saveGradient } from '@/api/paletteClient.js';
import { errorKey } from '@/errors.js';

function requestedGradient( items ) {
  const id = new URLSearchParams( window.location.hash.slice( 1 ) ).get( 'gradient' );
  return items.find( ( item ) => item.type === 'gradient' && item.id === id );
}

export function useGradientEditor( palette, editor ) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState( () =>
    createGradientDraft( editor ? requestedGradient( palette.colors ) : undefined )
  );
  const [expanded, setExpanded] = useState(
    () => editor && Boolean( requestedGradient( palette.colors ) )
  );
  const [working, setWorking] = useState( false );
  const [notice, setNotice] = useState( () =>
    editor &&
    new URLSearchParams( window.location.hash.slice( 1 ) ).has( 'gradient' ) &&
    !requestedGradient( palette.colors )
      ? { error: true, key: 'errors.gradientMissing' }
      : null
  );
  const operation = useRef( false );
  const container = useRef( null );

  const edit = useCallback(
    ( item ) => {
      if ( operation.current ) {
        setNotice( { error: true, key: 'gradient.wait' } );
        return;
      }
      if ( expanded && draft.id === item.id ) {
        container.current?.scrollIntoView( { block: 'start', behavior: 'smooth' } );
        return;
      }
      if ( expanded && draftDirty( draft ) && !window.confirm( t( 'gradient.discard' ) ) ) return;
      setDraft( createGradientDraft( item ) );
      setExpanded( true );
      setNotice( null );
      container.current?.scrollIntoView( { block: 'start', behavior: 'smooth' } );
    },
    [draft, expanded, t]
  );

  useEffect( () => {
    if ( !editor ) return;
    const requested = () => {
      const item = requestedGradient( palette.colors );
      if ( item ) edit( item );
      else if ( new URLSearchParams( window.location.hash.slice( 1 ) ).has( 'gradient' ) ) {
        setNotice( { error: true, key: 'errors.gradientMissing' } );
      }
    };
    window.addEventListener( 'hashchange', requested );
    return () => window.removeEventListener( 'hashchange', requested );
  }, [palette.colors, editor, edit] );

  async function pick( index ) {
    if ( operation.current ) return;
    operation.current = true;
    setWorking( true );
    setNotice( null );
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      setDraft( ( value ) => updateGradientDraft( value, { type: 'hex', index, value: sRGBHex } ) );
    } catch ( error ) {
      if ( error.name !== 'AbortError' ) setNotice( { error: true, key: 'errors.pickFailed' } );
    } finally {
      operation.current = false;
      setWorking( false );
    }
  }

  async function save() {
    if ( operation.current ) return;
    operation.current = true;
    setWorking( true );
    setNotice( null );
    try {
      await saveGradient( gradientFromDraft( draft ) );
      setDraft( createGradientDraft() );
      setNotice( { key: 'gradient.saved' } );
      // Keep the builder open in create mode.
      window.history.replaceState( null, '', window.location.pathname + window.location.search );
    } catch ( error ) {
      setNotice( { error: true, key: errorKey( error, 'gradientSave' ) } );
    } finally {
      operation.current = false;
      setWorking( false );
    }
  }

  function cancel() {
    setDraft( createGradientDraft() );
    setExpanded( false );
    setNotice( null );
    window.history.replaceState( null, '', window.location.pathname + window.location.search );
  }

  return {
    draft,
    setDraft,
    expanded,
    setExpanded,
    working,
    notice,
    setNotice,
    container,
    edit,
    pick,
    save,
    cancel,
  };
}
