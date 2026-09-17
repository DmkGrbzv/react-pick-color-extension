import ColorValues from '@/components/ColorValues.jsx';
import { colorValues } from '@/utils/colorConversion.js';
import '@/styles/components/ColorSwatch.css';
import { useTranslation } from 'react-i18next';

export default function ColorSwatch( { color, format = 'hex', onCopy, onRemove, disabled } ) {
  const { t } = useTranslation();
  return (
    <li className="color-card">
      <div className="swatch" style={ { backgroundColor: color.hex } } aria-hidden="true" />
      <div className="color-details">
        <ColorValues hex={ color.hex } primary={ format } />
        <div className="color-actions">
          <button
            type="button"
            onClick={ () => onCopy( colorValues( color.hex )[format] ) }
            aria-label={ t( 'copyColor', { hex: color.hex } ) }
          >
            { t( 'copy' ) }
          </button>
          <button
            type="button"
            className="delete"
            disabled={ disabled }
            onClick={ () => onRemove( color.id ) }
            aria-label={ t( 'removeColor', { hex: color.hex } ) }
          >
            { t( 'remove' ) }
          </button>
        </div>
      </div>
    </li>
  );
}
