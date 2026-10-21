import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gradientCss } from '@/utils/gradient.js';
import { colorValues } from '@/utils/colorConversion.js';
import SavedPalettePreview from '@/features/saved-palettes/components/SavedPalettePreview.jsx';

export default function SavedPaletteDetails( { palette, busy, onRename, onOpen, onRemove, onClose } ) {
  const { t } = useTranslation();
  const [name, setName] = useState( palette.name );
  const [format, setFormat] = useState( 'hex' );
  return (
    <section className="saved-details" aria-label={ t( 'library.details' ) }>
      <h3>{ t( 'library.details' ) }</h3>
      <form onSubmit={ ( event ) => { event.preventDefault(); void onRename( name ); } }>
        <label>{ t( 'library.name' ) }
          <input value={ name } maxLength={ 120 } disabled={ busy }
            onChange={ ( event ) => setName( event.target.value ) } />
        </label>
        <button type="submit" disabled={ busy || name.trim() === palette.name }>{ t( 'library.rename' ) }</button>
      </form>
      <label>{ t( 'formats.label' ) }
        <select value={ format } onChange={ ( event ) => setFormat( event.target.value ) }>
          { ['hex', 'rgb', 'cmyk'].map( ( value ) => <option key={ value } value={ value }>{ value.toUpperCase() }</option> ) }
        </select>
      </label>
      { format === 'cmyk' && <p className="hint">{ t( 'print.warning' ) }</p> }
      <ul className="saved-detail-items">
        { palette.items.map( ( item, index ) => (
          <li key={ index }>
            <SavedPalettePreview items={ [item] } />
            <code>{ item.type === 'gradient' ? gradientCss( item ) : colorValues( item.hex )[format] }</code>
          </li>
        ) ) }
      </ul>
      <p className="hint">{ t( 'library.editHint' ) }</p>
      <div className="saved-actions">
        <button type="button" disabled={ busy } onClick={ onOpen }>{ t( 'library.open' ) }</button>
        <button type="button" className="saved-delete" disabled={ busy } onClick={ onRemove }>{ t( 'library.delete' ) }</button>
        <button type="button" onClick={ onClose }>{ t( 'library.close' ) }</button>
      </div>
    </section>
  );
}
