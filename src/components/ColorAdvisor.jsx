import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ADVISOR_CATEGORIES, ACCENT_TYPES } from '@/constants/advisorTypes.js';
import { createColorSuggestions } from '@/utils/colorSuggestions.js';
import { useColorAdvisorActions } from '@/hooks/useColorAdvisorActions.js';
import ColorSuggestions from '@/components/ColorSuggestions.jsx';
import ColorComparison from '@/components/ColorComparison.jsx';
import '@/styles/components/ColorAdvisor.css';

export default function ColorAdvisor( { id, source, savedColors, format, disabled, onClose } ) {
  const { t } = useTranslation();
  const [category, setCategory] = useState( ADVISOR_CATEGORIES.SHADES );
  const [selectedHex, setSelectedHex] = useState( null );
  const { saving, notice, add, copy } = useColorAdvisorActions();
  const suggestions = createColorSuggestions( source.hex );
  const savedHexes = new Set(
    savedColors.filter( ( item ) => item.type !== 'gradient' ).map( ( item ) => item.hex.toUpperCase() )
  );
  const alreadyAdded = savedHexes.has( selectedHex );
  const groups = category === ADVISOR_CATEGORIES.ACCENTS ? Object.values( ACCENT_TYPES ) : [category];

  return (
    <section className="color-advisor" id={ id } aria-labelledby={ id + '-title' }>
      <div className="advisor-heading">
        <h3 id={ id + '-title' }>{ t( 'advisor.title' ) }</h3>
        <button type="button" onClick={ onClose }>
          { t( 'advisor.close' ) }
        </button>
      </div>
      <div className="advisor-source">
        <span style={ { backgroundColor: suggestions.source } } aria-hidden="true" />
        <div>
          { t( 'advisor.source' ) }
          <code>{ suggestions.source }</code>
        </div>
      </div>
      <label className="advisor-category" htmlFor={ id + '-category' }>
        { t( 'advisor.category' ) }
        <select
          id={ id + '-category' }
          value={ category }
          onChange={ ( event ) => {
            setCategory( event.target.value );
            setSelectedHex( null );
          } }
          aria-describedby={ id + '-explanation' }
        >
          { Object.values( ADVISOR_CATEGORIES ).map( ( value ) => (
            <option
              key={ value }
              value={ value }
              disabled={ suggestions.isNeutral && value !== ADVISOR_CATEGORIES.SHADES }
            >
              { t( 'advisor.categories.' + value ) }
            </option>
          ) ) }
        </select>
      </label>
      <p id={ id + '-explanation' } className="hint">
        { t( 'advisor.descriptions.' + category ) }
      </p>
      { suggestions.isNeutral && <p className="hint">{ t( 'advisor.neutral' ) }</p> }
      { groups.map( ( group ) => (
        <ColorSuggestions
          key={ group }
          heading={ category === ADVISOR_CATEGORIES.ACCENTS ? group : undefined }
          colors={ suggestions[group] }
          selectedHex={ selectedHex }
          savedHexes={ savedHexes }
          onSelect={ setSelectedHex }
        />
      ) ) }
      { selectedHex && (
        <>
          <ColorComparison
            key={ selectedHex }
            sourceHex={ suggestions.source }
            selectedHex={ selectedHex }
          />
          <div className="advisor-actions">
            <button
              type="button"
              className="primary"
              disabled={ disabled || saving || alreadyAdded }
              onClick={ () => add( selectedHex ) }
            >
              { t( alreadyAdded ? 'advisor.alreadyAdded' : saving ? 'busy' : 'advisor.add' ) }
            </button>
            <button type="button" onClick={ () => copy( selectedHex, format ) }>
              { t( 'advisor.copy', { format: format.toUpperCase() } ) }
            </button>
          </div>
        </>
      ) }
      <p className="hint">{ t( 'advisor.guidance' ) }</p>
      <div className="advisor-notice" role="status" aria-live="polite">
        { notice && (
          <p className={ notice.error ? 'error' : 'success' }>{ t( notice.key, notice.values ) }</p>
        ) }
      </div>
    </section>
  );
}
