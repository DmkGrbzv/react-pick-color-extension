import { useTranslation } from 'react-i18next';
import './ColorSuggestions.css';

export default function ColorSuggestions( { colors, selectedHex, savedHexes, onSelect, heading, colorLabels = {} } ) {
  const { t } = useTranslation();
  return (
    <div className="color-suggestions">
      { heading && (
        <>
          <h4>{ t( 'advisor.' + heading + '.title' ) }</h4>
          <p className="hint">{ t( 'advisor.' + heading + '.description' ) }</p>
        </>
      ) }
      <div className="suggestion-grid">
        { colors.map( ( hex ) => (
          <button
            type="button"
            key={ hex }
            className="suggestion-option"
            aria-label={ [t( 'advisor.previewColor', { hex } ), colorLabels[hex]].filter( Boolean ).join( '. ' ) }
            aria-pressed={ selectedHex === hex }
            onClick={ () => onSelect( hex ) }
          >
            <span
              className="suggestion-swatch"
              style={ { backgroundColor: hex } }
              aria-hidden="true"
            />
            <span>{ hex }</span>
            { colorLabels[hex] && <span className="suggestion-label">{ colorLabels[hex] }</span> }
            { savedHexes.has( hex ) && (
              <span className="suggestion-saved">{ t( 'advisor.alreadyAdded' ) }</span>
            ) }
          </button>
        ) ) }
      </div>
    </div>
  );
}
