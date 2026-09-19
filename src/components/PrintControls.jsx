import Icon from '@/components/Icon.jsx';
import { useTranslation } from 'react-i18next';
import '@/styles/components/PrintControls.css';
export default function PrintControls( { settings, onChange, disabled } ) {
  const { t } = useTranslation();
  return (
    <section className="print-controls" aria-label={ t( 'print.settings' ) }>
      <div className="print-controls-heading">
        <h1>{ t( 'print.title' ) }</h1>
        <span className="paper-badge">A4</span>
      </div>
      <div className="print-settings-grid">
        { ['orientation', 'size', 'background'].map( ( key ) => (
          <label key={ key }>
            { t( 'print.' + key ) }
            <select
              value={ settings[key] }
              onChange={ ( event ) => onChange( { ...settings, [key]: event.target.value } ) }
            >
              { {
                orientation: ['portrait', 'landscape'],
                size: ['medium', 'large'],
                background: ['white', 'warm'],
              }[key].map( ( value ) => (
                <option key={ value } value={ value }>
                  { t( 'print.' + value ) }
                </option>
              ) ) }
            </select>
          </label>
        ) ) }
        <fieldset>
          <legend>{ t( 'print.show' ) }</legend>
          { ['hex', 'rgb', 'cmyk', 'names'].map( ( key ) => (
            <label key={ key }>
              <input
                type="checkbox"
                checked={ settings[key] }
                onChange={ ( event ) => onChange( { ...settings, [key]: event.target.checked } ) }
              />
              { key === 'names' ? t( 'print.names' ) : key.toUpperCase() }
            </label>
          ) ) }
        </fieldset>
      </div>
      <div className="print-controls-footer">
        <div>
          <p className="hint">{ t( 'print.warning' ) }</p>
          <details className="print-dialog-help">
            <summary>{ t( 'print.dialogHelp' ) }</summary>
            <p className="hint">{ t( 'print.dialogHint' ) }</p>
          </details>
        </div>
        <button
          type="button"
          className="primary"
          disabled={ disabled }
          onClick={ () => window.print() }
        >
          <Icon name="print" />
          { t( 'print.action' ) }
        </button>
      </div>
    </section>
  );
}
