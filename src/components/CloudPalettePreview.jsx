import { gradientCss } from '@/gradient.js';

export default function CloudPalettePreview( { items, maximum = 5 } ) {
  return (
    <span className="cloud-preview" aria-hidden="true">
      { items.slice( 0, maximum ).map( ( item, index ) => (
        <span key={ index } style={ {
          background: item.type === 'gradient' ? gradientCss( item ) : item.hex,
        } } />
      ) ) }
      { items.length > maximum && <span className="cloud-extra">+{ items.length - maximum }</span> }
    </span>
  );
}
