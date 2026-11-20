import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findHistoricalPalettes } from '../utils/historicalPalettes.js';
import ColorSuggestions from './ColorSuggestions.jsx';
import './HistoricalPalettes.css';

export default function HistoricalPalettes( { sourceHex, selectedHex, savedHexes, onSelect, onAddAll, disabled } ) {
  const { t } = useTranslation();
  const [variant, setVariant] = useState( 'original' );
  const palettes = useMemo( () => findHistoricalPalettes( sourceHex ), [sourceHex] );
  return (
    <div className="historical-palettes">
      <label>
        { t( 'advisor.historical.variant' ) }
        <select value={ variant } onChange={ event => { setVariant( event.target.value ); onSelect( null ); } }>
          <option value="original">{ t( 'advisor.historical.original' ) }</option>
          <option value="adapted">{ t( 'advisor.historical.adapted' ) }</option>
        </select>
      </label>
      <p className="hint">{ t( 'advisor.historical.' + ( variant === 'original' ? 'originalHint' : 'adaptedHint' ) ) }</p>
      { palettes.map( palette => {
        const colors = palette[variant];
        const allAdded = colors.every( hex => savedHexes.has( hex ) );
        return (
          <section className="historical-palette" key={ palette.id } aria-label={ t( 'advisor.historical.combination', { id: palette.id } ) }>
            <h4>{ t( 'advisor.historical.combination', { id: palette.id } ) }</h4>
            <ColorSuggestions colors={ colors } selectedHex={ selectedHex } savedHexes={ savedHexes } onSelect={ onSelect } />
            <button type="button" disabled={ disabled || allAdded } onClick={ () => onAddAll( colors ) }>
              { t( allAdded ? 'advisor.alreadyAdded' : 'advisor.historical.addAll' ) }
            </button>
          </section>
        );
      } ) }
      <p className="hint">{ t( 'advisor.historical.credit' ) } <a href="THIRD-PARTY-NOTICES.txt" target="_blank" rel="noreferrer">{ t( 'advisor.historical.notices' ) }</a></p>
    </div>
  );
}
