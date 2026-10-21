import { gradientCss } from '@/utils/gradient.js';

export default function SavedPalettePreview( { items, maximum = 5 } ) {
  return (
    <span className="saved-preview" aria-hidden="true">
      { items.slice( 0, maximum ).map( ( item, index ) => (
        <span key={ index } style={ {
          background: item.type === 'gradient' ? gradientCss( item ) : item.hex,
        } } />
      ) ) }
      { items.length > maximum && <span className="saved-extra">+{ items.length - maximum }</span> }
    </span>
  );
}
