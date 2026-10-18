import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gradientCss } from '@/gradient.js';
import { colorValues } from '@/utils/colorConversion.js';
import CloudPalettePreview from '@/components/CloudPalettePreview.jsx';

export default function CloudPaletteDetails( { palette, busy, onRename, onOpen, onRemove, onClose } ) {
  const { t } = useTranslation();
  const [name, setName] = useState( palette.name );
  const [format, setFormat] = useState( 'hex' );
  return (
    <section className="cloud-details" aria-label={ t( 'cloud.details' ) }>
      <h3>{ t( 'cloud.details' ) }</h3>
      <form onSubmit={ ( event ) => { event.preventDefault(); void onRename( name ); } }>
        <label>{ t( 'cloud.name' ) }
          <input value={ name } maxLength={ 120 } disabled={ busy }
            onChange={ ( event ) => setName( event.target.value ) } />
        </label>
        <button type="submit" disabled={ busy || name.trim() === palette.name }>{ t( 'cloud.rename' ) }</button>
      </form>
      <label>{ t( 'formats.label' ) }
        <select value={ format } onChange={ ( event ) => setFormat( event.target.value ) }>
          { ['hex', 'rgb', 'cmyk'].map( ( value ) => <option key={ value } value={ value }>{ value.toUpperCase() }</option> ) }
        </select>
      </label>
      { format === 'cmyk' && <p className="hint">{ t( 'print.warning' ) }</p> }
      <ul className="cloud-detail-items">
        { palette.items.map( ( item, index ) => (
          <li key={ index }>
            <CloudPalettePreview items={ [item] } />
            <code>{ item.type === 'gradient' ? gradientCss( item ) : colorValues( item.hex )[format] }</code>
          </li>
        ) ) }
      </ul>
      <p className="hint">{ t( 'cloud.editHint' ) }</p>
      <div className="cloud-actions">
        <button type="button" disabled={ busy } onClick={ onOpen }>{ t( 'cloud.open' ) }</button>
        <button type="button" className="cloud-delete" disabled={ busy } onClick={ onRemove }>{ t( 'cloud.delete' ) }</button>
        <button type="button" onClick={ onClose }>{ t( 'cloud.close' ) }</button>
      </div>
    </section>
  );
}
