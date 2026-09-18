import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/styles/components/ColorComparison.css';

export default function ColorComparison( { sourceHex, selectedHex } ) {
  const { t } = useTranslation();
  const [swapped, setSwapped] = useState( false );
  const background = swapped ? selectedHex : sourceHex;
  const accent = swapped ? sourceHex : selectedHex;
  return (
    <div className="color-comparison">
      <div className="comparison-pair">
        { [
          [sourceHex, 'source'],
          [selectedHex, 'selected'],
        ].map( ( [hex, label] ) => (
          <figure key={ label }>
            <div
              className="comparison-swatch"
              style={ { backgroundColor: hex } }
              aria-hidden="true"
            />
            <figcaption>
              { t( 'advisor.' + label ) }
              <code>{ hex }</code>
            </figcaption>
          </figure>
        ) ) }
      </div>
      <div
        className="comparison-composition"
        style={ { backgroundColor: background } }
        role="img"
        aria-label={ t( 'advisor.composition', { background, accent } ) }
      >
        <div style={ { backgroundColor: accent } } />
      </div>
      <button type="button" onClick={ () => setSwapped( ( value ) => !value ) }>
        { t( 'advisor.swap' ) }
      </button>
    </div>
  );
}
