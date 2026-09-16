import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DIRECTIONS, draftErrors, gradientCss, validPosition } from '../gradient';

export default function GradientBuilder( {
  draft,
  onChange,
  onSave,
  onCancel,
  colors,
  busy,
  notice,
} ) {
  const { t } = useTranslation();
  const prefix = useId();
  const errors = draftErrors( draft );
  const supported = typeof window.EyeDropper === 'function';
  return (
    <form
      className="gradient-builder"
      onSubmit={ ( event ) => {
        event.preventDefault();
        onSave();
      } }
      noValidate
    >
      <h2>{ t( draft.id ? 'gradient.editTitle' : 'gradient.create' ) }</h2>
      <div
        className="gradient-preview"
        style={ { background: gradientCss( draft.preview ) } }
        role="img"
        aria-label={ t( 'gradient.preview' ) }
      />
      <fieldset disabled={ busy }>
        <div className="gradient-fields">
          { draft.stops.map( ( stop, index ) => {
            const id = prefix + '-' + index;
            const positionError = errors.position[index] || errors.order;
            return (
              <div className="gradient-color-field" key={ index }>
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
                  { /* <button type="button" onClick={() => onPick(index)} disabled={!supported}>{t('gradient.pick')}</button> */ }
                  <label>
                    <span className="sr-only">{ t( 'gradient.savedColors' ) }</span>
                    <select
                      value=""
                      onChange={ ( event ) => {
                        if ( event.target.value )
                          onChange( { type: 'hex', index, value: event.target.value } );
                      } }
                    >
                      <option value="">{ t( 'gradient.savedColors' ) }</option>
                      { colors.map( ( color ) => (
                        <option key={ color.id } value={ color.hex }>
                          { color.hex }
                        </option>
                      ) ) }
                    </select>
                  </label>
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
                  onChange={ ( event ) =>
                    onChange( { type: 'position', index, value: event.target.value } )
                  }
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  aria-label={ t( 'gradient.slider', { number: index + 1 } ) }
                  value={
                    validPosition( stop.position )
                      ? Number( stop.position )
                      : draft.preview.stops[index].position
                  }
                  onChange={ ( event ) =>
                    onChange( { type: 'slider', index, value: event.target.value } )
                  }
                />
                { positionError && (
                  <p id={ id + '-position-error' } className="error">
                    { t(
                      errors.position[index] ? 'gradient.invalidPosition' : 'gradient.invalidOrder'
                    ) }
                  </p>
                ) }
              </div>
            );
          } ) }
        </div>
        { !supported && <p className="hint">{ t( 'unsupported' ) }</p> }
        <p className="hint">{ t( 'gradient.positionHint' ) }</p>
        <div className="gradient-direction">
          <label>
            { t( 'gradient.direction' ) }
            <select
              value={ draft.direction }
              onChange={ ( event ) => onChange( { type: 'direction', value: event.target.value } ) }
            >
              { Object.keys( DIRECTIONS ).map( ( direction ) => (
                <option key={ direction } value={ direction }>
                  { t( 'gradient.directions.' + direction ) }
                </option>
              ) ) }
            </select>
          </label>
          <button type="button" onClick={ () => onChange( { type: 'swap' } ) }>
            { t( 'gradient.swap' ) }
          </button>
        </div>
        <div className="gradient-buttons">
          <button className="primary" type="submit" disabled={ errors.invalid }>
            { t( draft.id ? 'gradient.saveChanges' : 'gradient.save' ) }
          </button>
          <button type="button" onClick={ onCancel }>
            { t( 'gradient.cancel' ) }
          </button>
        </div>
      </fieldset>
      <div role="status" aria-live="polite">
        { busy && <p className="hint">{ t( 'busy' ) }</p> }
        { notice && <p className={ notice.error ? 'error' : 'success' }>{ t( notice.key ) }</p> }
      </div>
    </form>
  );
}
