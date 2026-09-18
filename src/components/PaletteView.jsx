import ColorFormatSelector from '@/components/ColorFormatSelector.jsx';
import PrintPreviewButton from '@/components/PrintPreviewButton.jsx';
import { useColorFormat } from '@/hooks/useColorFormat.js';
import '@/styles/pages/PaletteView.css';
import PaletteHeader from '@/components/PaletteHeader.jsx';
import PaletteToolbar from '@/components/PaletteToolbar.jsx';
import { usePaletteActions } from '@/hooks/usePaletteActions.js';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '@/errors.js';
import { usePalette } from '@/usePalette.js';
import PaletteItems from '@/components/PaletteItems.jsx';
import LanguageSelector from '@/components/LanguageSelector.jsx';

export default function PaletteView( { editor = false } ) {
  const { t } = useTranslation();
  const colorFormat = useColorFormat();
  const { palette, error, retry } = usePalette();
  const { notice, busy, opening, supported, pickColor, copy, remove, showEditor } =
    usePaletteActions();

  useEffect( () => {
    document.title = t( editor ? 'editorTitle' : 'panelTitle' );
  }, [editor, t] );

  return (
    <main className={ editor ? 'app editor' : 'app panel' }>
      <LanguageSelector />
      <PaletteHeader editor={ editor } palette={ palette } />

      { !editor && (
        <PaletteToolbar
          palette={ palette }
          busy={ busy }
          supported={ supported }
          opening={ opening }
          onPick={ pickColor }
          onOpenEditor={ () => showEditor() }
        />
      ) }

      <ColorFormatSelector { ...colorFormat } />
      <PrintPreviewButton disabled={ !palette } />
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
          format={ colorFormat.format }
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
