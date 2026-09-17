import '@/styles/components/GradientDirection.css';
import { useTranslation } from 'react-i18next';
import { DIRECTIONS } from '@/gradient.js';
export default function GradientDirection( { direction, onChange } ) {
  const { t } = useTranslation();

  return (
    <div className="gradient-direction">
      <label>
        { t( 'gradient.direction' ) }
        <select
          value={ direction }
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
  );
}
