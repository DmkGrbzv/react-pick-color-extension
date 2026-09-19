import { useTranslation } from 'react-i18next';
import { COLOR_FORMATS } from '@/utils/colorConversion.js';
import '@/styles/components/ColorFormatSelector.css';
export default function ColorFormatSelector( { format, change, error, disabled } ) {
  const { t } = useTranslation();
  return (
    <div className="format-control">
      <label>
        { t( 'formats.label' ) }{ ' ' }
        <select value={ format } disabled={ disabled } onChange={ ( event ) => change( event.target.value ) }>
          { COLOR_FORMATS.map( ( value ) => (
            <option key={ value } value={ value }>
              { value.toUpperCase() }
            </option>
          ) ) }
        </select>
      </label>
      { error && (
        <p role="alert" className="error">
          { t( 'formats.failed' ) }
        </p>
      ) }
    </div>
  );
}
