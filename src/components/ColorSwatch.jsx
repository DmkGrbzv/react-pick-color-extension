import { useTranslation } from 'react-i18next';

export default function ColorSwatch( { color, onCopy, onRemove, disabled } ) {
  const { t } = useTranslation();
  return (
    <li className="color-card">
      <div className="swatch" style={ { backgroundColor: color.hex } } aria-hidden="true" />
      <div className="color-details">
        <code>{ color.hex }</code>
        <div className="color-actions">
          <button
            type="button"
            onClick={ () => onCopy( color.hex ) }
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
