import '@/styles/components/GradientBuilder.css';
import GradientStopField from '@/components/GradientStopField.jsx';
import GradientDirection from '@/components/GradientDirection.jsx';
import { useTranslation } from 'react-i18next';
import { draftErrors, gradientCss } from '@/gradient.js';

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
          { draft.stops.map( ( stop, index ) => (
            <GradientStopField
              key={ index }
              stop={ stop }
              index={ index }
              errors={ errors }
              preview={ draft.preview.stops[index] }
              colors={ colors }
              onChange={ onChange }
            />
          ) ) }
        </div>
        { !supported && <p className="hint">{ t( 'unsupported' ) }</p> }
        <p className="hint">{ t( 'gradient.positionHint' ) }</p>
        <GradientDirection direction={ draft.direction } onChange={ onChange } />
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
