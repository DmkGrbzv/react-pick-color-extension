import { useTranslation } from 'react-i18next';
import '@/styles/components/PrintControls.css';
export default function PrintControls( { settings, onChange, disabled } ) {
  const { t } = useTranslation();
  return (
    <section className="print-controls" aria-label={ t( 'print.settings' ) }>
      <h1>{ t( 'print.title' ) }</h1>
      <p>A4</p>
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
      <p className="hint">{ t( 'print.warning' ) }</p>
      <p className="hint">{ t( 'print.dialogHint' ) }</p>
      <button type="button" className="primary" disabled={ disabled } onClick={ () => window.print() }>
        { t( 'print.action' ) }
      </button>
    </section>
  );
}
