import SavedColorSelect from './SavedColorSelect.jsx';
import './GradientStopField.css';
import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import { validPosition } from '@/utils/gradient.js';
export default function GradientStopField( { stop, index, errors, preview, colors, onChange } ) {
  const { t } = useTranslation();
  const id = useId();
  const positionError = errors.position[index] || errors.order;
  return (
    <div className="gradient-color-field">
      <h3>{ t( 'gradient.color', { number: index + 1 } ) }</h3>
      <label htmlFor={ id + '-hex' }>HEX</label>
      <input
        id={ id + '-hex' }
        value={ stop.hex }
        spellCheck={ false }
        autoComplete="off"
        aria-invalid={ errors.hex[index] }
        aria-describedby={ errors.hex[index] ? id + '-hex-error' : undefined }
        onChange={ ( event ) => onChange( { type: 'hex', index, value: event.target.value } ) }
      />
      { errors.hex[index] && (
        <p id={ id + '-hex-error' } className="error">
          { t( 'gradient.invalidHex' ) }
        </p>
      ) }
      <div className="gradient-color-actions">
        <SavedColorSelect colors={ colors } value={ stop.hex }
          label={ t( 'gradient.savedColors' ) + ' - ' + t( 'gradient.color', { number: index + 1 } ) }
          onChange={ ( value ) => onChange( { type: 'hex', index, value } ) } />
      </div>
      <label htmlFor={ id + '-position' }>{ t( 'gradient.position' ) }</label>
      <input
        id={ id + '-position' }
        type="number"
        min="0"
        max="100"
        step="1"
        value={ stop.position }
        aria-invalid={ positionError }
        aria-describedby={ positionError ? id + '-position-error' : undefined }
        onChange={ ( event ) => onChange( { type: 'position', index, value: event.target.value } ) }
      />
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        aria-label={ t( 'gradient.slider', { number: index + 1 } ) }
        value={ validPosition( stop.position ) ? Number( stop.position ) : preview.position }
        onChange={ ( event ) => onChange( { type: 'slider', index, value: event.target.value } ) }
      />
      { positionError && (
        <p id={ id + '-position-error' } className="error">
          { t( errors.position[index] ? 'gradient.invalidPosition' : 'gradient.invalidOrder' ) }
        </p>
      ) }
    </div>
  );
}
