import { useTranslation } from 'react-i18next';
import ColorFormatSelector from '@/components/ColorFormatSelector.jsx';
import PaletteToolbar from '@/components/PaletteToolbar.jsx';
import PaletteItems from '@/components/PaletteItems.jsx';
import { useColorFormat } from '@/hooks/useColorFormat.js';
import { usePaletteActions } from '@/hooks/usePaletteActions.js';

export default function WorkingPalette( { palette, panel } ) {
  const { t } = useTranslation();
  const colorFormat = useColorFormat();
  const { notice, busy, opening, supported, pickColor, copy, remove, showEditor } = usePaletteActions();
  return (
    <>
      { panel && <PaletteToolbar palette={ palette } busy={ busy } supported={ supported } onPick={ pickColor } /> }
      <div className="palette-controls">
        <ColorFormatSelector { ...colorFormat } />
        { colorFormat.format === 'cmyk' && <p className="hint color-format-warning">{ t( 'print.warning' ) }</p> }
      </div>
      { palette && <PaletteItems format={ colorFormat.format } palette={ palette } editor={ !panel }
        busy={ busy || opening } onCopy={ copy } onRemove={ remove }
        onEditInPanel={ ( item ) => showEditor( item.id ) } /> }
      <div className="notice" role="status" aria-live="polite">
        { notice && <p className={ notice.error ? 'error' : 'success' }>{ t( notice.key, notice.values ) }</p> }
      </div>
    </>
  );
}
