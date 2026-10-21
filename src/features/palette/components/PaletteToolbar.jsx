import './PaletteToolbar.css';
import Icon from '@/components/ui/Icon.jsx';
import { useTranslation } from 'react-i18next';

export default function PaletteToolbar( {
  palette,
  busy,
  supported,
  onPick,
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
        <Icon name="eyedropper" />
        { t( busy ? 'busy' : 'pick' ) }
      </button>
      { !supported && (
        <p className="error" role="status">
          { t( 'unsupported' ) }
        </p>
      ) }
      <p className="hint">{ t( 'pickHint' ) }</p>
    </div>
  );
}
