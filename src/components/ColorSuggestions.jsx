import { useTranslation } from 'react-i18next';
import '@/styles/components/ColorSuggestions.css';

export default function ColorSuggestions( { colors, selectedHex, savedHexes, onSelect, heading } ) {
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
            aria-label={ t( 'advisor.previewColor', { hex } ) }
            aria-pressed={ selectedHex === hex }
            onClick={ () => onSelect( hex ) }
          >
            <span
              className="suggestion-swatch"
              style={ { backgroundColor: hex } }
              aria-hidden="true"
            />
            <span>{ hex }</span>
            { savedHexes.has( hex ) && (
              <span className="suggestion-saved">{ t( 'advisor.alreadyAdded' ) }</span>
            ) }
          </button>
        ) ) }
      </div>
    </div>
  );
}
