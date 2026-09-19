import Icon from '@/components/Icon.jsx';
import { useId, useRef } from 'react';
import ColorAdvisor from '@/components/ColorAdvisor.jsx';
import ColorValues from '@/components/ColorValues.jsx';
import { colorValues } from '@/utils/colorConversion.js';
import '@/styles/components/ColorSwatch.css';
import { useTranslation } from 'react-i18next';

export default function ColorSwatch( {
  color,
  format = 'hex',
  onCopy,
  onRemove,
  disabled,
  savedColors,
  advisorOpen,
  onToggleAdvisor,
} ) {
  const { t } = useTranslation();
  const advisorId = useId();
  const advisorButton = useRef( null );
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
            <Icon name="copy" />
            { t( 'copy' ) }
          </button>
          <button
            type="button"
            className="delete icon-button"
            title={ t( 'remove' ) }
            disabled={ disabled }
            onClick={ () => onRemove( color.id ) }
            aria-label={ t( 'removeColor', { hex: color.hex } ) }
          >
            <Icon name="trash" />
          </button>
          <button
            type="button"
            ref={ advisorButton }
            className="advisor-toggle icon-button"
            title={ t( 'advisor.open' ) }
            aria-label={ t( 'advisor.openFor', { hex: color.hex } ) }
            aria-expanded={ advisorOpen }
            aria-controls={ advisorOpen ? advisorId : undefined }
            onClick={ onToggleAdvisor }
          >
            <Icon name="bulb" />
          </button>
        </div>
      </div>
      { advisorOpen && (
        <ColorAdvisor
          key={ color.id + color.hex }
          id={ advisorId }
          source={ color }
          savedColors={ savedColors }
          format={ format }
          disabled={ disabled }
          onClose={ () => {
            onToggleAdvisor();
            advisorButton.current?.focus();
          } }
        />
      ) }
    </li>
  );
}
