import '@/styles/components/PaletteToolbar.css';
import { useTranslation } from 'react-i18next';

export default function PaletteToolbar( {
  palette,
  busy,
  supported,
  opening,
  onPick,
  onOpenEditor,
} ) {
  const { t } = useTranslation();

  return (
    <div className="toolbar">
      <button
        type="button"
        className="primary"
        onClick={ onPick }
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
      <button type="button" className="secondary" onClick={ onOpenEditor } disabled={ opening }>
        { t( opening ? 'opening' : 'openEditor' ) }
      </button>
    </div>
  );
}
