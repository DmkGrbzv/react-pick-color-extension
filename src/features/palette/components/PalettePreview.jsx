import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moveItemFirst } from '@/extension/clients/paletteClient.js';
import { gradientCss } from '@/utils/gradient.js';
import './PalettePreview.css';

export default function PalettePreview( { items } ) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState( false );
  async function move( id ) {
    try {
      await moveItemFirst( id );
      setFailed( false );
    } catch {
      setFailed( true );
    }
  }
  return <div className="palette-preview">
    <div className="palette-preview-grid" role="group" aria-label={ t( 'palettePreview.label' ) }>
      { items.map( ( item ) => {
        const value = item.type === 'gradient' ? gradientCss( item ) : item.hex;
        const label = value + ' - ' + t( 'palettePreview.moveFirst' );
        return <button key={ item.id } type="button" style={ { background: value } }
          aria-label={ label } onClick={ () => void move( item.id ) } />;
      } ) }
    </div>
    { failed && <p role="alert" className="error">{ t( 'palettePreview.failed' ) }</p> }
  </div>;
}
