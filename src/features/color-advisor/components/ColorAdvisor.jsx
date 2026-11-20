import Icon from '@/components/ui/Icon.jsx';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ADVISOR_CATEGORIES, ACCENT_TYPES } from '@/constants/advisorTypes.js';
import { createColorSuggestions } from '@/features/color-advisor/utils/colorSuggestions.js';
import { useColorAdvisorActions } from '@/features/color-advisor/hooks/useColorAdvisorActions.js';
import ColorSuggestions from '@/features/color-advisor/components/ColorSuggestions.jsx';
import ColorComparison from '@/features/color-advisor/components/ColorComparison.jsx';
import HistoricalPalettes from './HistoricalPalettes.jsx';
import './ColorAdvisor.css';

export default function ColorAdvisor( { id, source, savedColors, format, disabled, onClose } ) {
  const { t } = useTranslation();
  const [category, setCategory] = useState( ADVISOR_CATEGORIES.SHADES );
  const [selectedHex, setSelectedHex] = useState( null );
  const { saving, notice, add, addAll, copy } = useColorAdvisorActions();
  const suggestions = useMemo( () => createColorSuggestions( source.hex ), [source.hex] );
  const savedHexes = useMemo(
    () => new Set(
      savedColors.filter( ( item ) => item.type !== 'gradient' ).map( ( item ) => item.hex.toUpperCase() )
    ),
    [savedColors]
  );
  const alreadyAdded = savedHexes.has( selectedHex );
  const groups = category === ADVISOR_CATEGORIES.ACCENTS ? Object.values( ACCENT_TYPES ) : [category];

  return (
    <section className="color-advisor" id={ id } aria-labelledby={ id + '-title' }>
      <div className="advisor-heading">
        <h3 id={ id + '-title' }>{ t( category === ADVISOR_CATEGORIES.HISTORICAL ? 'advisor.historical.title' : 'advisor.title' ) }</h3>
        <button type="button" onClick={ onClose }>
          <Icon name="close" />
          { t( 'advisor.close' ) }
        </button>
      </div>
      <div className="advisor-source">
        <span style={ { backgroundColor: suggestions.source } } aria-hidden="true" />
        <div>
          { t( category === ADVISOR_CATEGORIES.HISTORICAL ? 'advisor.historical.yourColor' : 'advisor.source' ) }
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
              disabled={ suggestions.isNeutral && value !== ADVISOR_CATEGORIES.SHADES && value !== ADVISOR_CATEGORIES.HISTORICAL }
            >
              { t( 'advisor.categories.' + value ) }
            </option>
          ) ) }
        </select>
      </label>
      <p id={ id + '-explanation' } className="hint">
        { t( 'advisor.descriptions.' + category ) }
      </p>
      { suggestions.isNeutral && category !== ADVISOR_CATEGORIES.HISTORICAL && <p className="hint">{ t( 'advisor.neutral' ) }</p> }
      { category === ADVISOR_CATEGORIES.HISTORICAL ? (
        <HistoricalPalettes sourceHex={ suggestions.source } selectedHex={ selectedHex } savedHexes={ savedHexes }
          onSelect={ setSelectedHex } onAddAll={ addAll } disabled={ disabled || saving } />
      ) : groups.map( ( group ) => (
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
              <Icon name={ alreadyAdded ? 'check' : 'plus' } />
              { t( alreadyAdded ? 'advisor.alreadyAdded' : saving ? 'busy' : 'advisor.add' ) }
            </button>
            <button type="button" onClick={ () => copy( selectedHex, category === ADVISOR_CATEGORIES.HISTORICAL ? 'hex' : format ) }>
              <Icon name="copy" />
              { t( 'advisor.copy', { format: category === ADVISOR_CATEGORIES.HISTORICAL ? 'HEX' : format.toUpperCase() } ) }
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
