import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addColor, openEditor, removeColor } from '../storage';
import { errorKey } from '../errors';
import { usePalette } from '../usePalette';
import PaletteItems from './PaletteItems';
import LanguageSelector from './LanguageSelector';

export default function PaletteView( { editor = false } ) {
  const { t } = useTranslation();
  const { palette, error, retry } = usePalette();
  const [notice, setNotice] = useState( null );
  const [busy, setBusy] = useState( false );
  const [opening, setOpening] = useState( false );
  const operationRef = useRef( false );
  const supported = typeof window.EyeDropper === 'function';

  useEffect( () => {
    document.title = t( editor ? 'editorTitle' : 'panelTitle' );
  }, [editor, t] );

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
      setNotice( { key: css ? 'gradient.cssCopied' : 'colorCopied', values: { hex } } );
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

  return (
    <main className={ editor ? 'app editor' : 'app panel' }>
      <LanguageSelector />
      <header>
        <p className="eyebrow">COLOR PALETTE / { t( editor ? 'editor' : 'eyedropper' ) }</p>
        <h1>{ !palette || palette.id === 'current' ? t( 'paletteName' ) : palette.name }</h1>
        <p className="intro">{ t( editor ? 'editorIntro' : 'panelIntro' ) }</p>
      </header>

      { !editor && (
        <div className="toolbar">
          <button
            type="button"
            className="primary"
            onClick={ pickColor }
            disabled={ !palette || busy || !supported }
          >
            { t( busy ? 'busy' : 'pick' ) }
          </button>
          { !supported && (
            <p className="error" role="status">
              { t( 'unsupported' ) }
            </p>
          ) }
          <p className="hint">{ t( 'pickHint' ) }</p>
          <button
            type="button"
            className="secondary"
            onClick={ () => showEditor() }
            disabled={ opening }
          >
            { t( opening ? 'opening' : 'openEditor' ) }
          </button>
        </div>
      ) }

      { error ? (
        <div className="error" role="alert">
          <p>{ t( errorKey( error, 'storageFailure' ) ) }</p>
          <button type="button" onClick={ retry }>
            { t( 'retry' ) }
          </button>
        </div>
      ) : !palette ? (
        <p role="status">{ t( 'loading' ) }</p>
      ) : (
        <PaletteItems
          palette={ palette }
          editor={ editor }
          busy={ busy || opening }
          onCopy={ copy }
          onRemove={ remove }
          onEditInPanel={ ( item ) => showEditor( item.id ) }
        />
      ) }
      <div className="notice" role="status" aria-live="polite">
        { notice && (
          <p className={ notice.error ? 'error' : 'success' }>{ t( notice.key, notice.values ) }</p>
        ) }
      </div>
    </main>
  );
}
