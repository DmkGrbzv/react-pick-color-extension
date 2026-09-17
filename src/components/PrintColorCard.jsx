import { useTranslation } from 'react-i18next';
import { gradientCss } from '@/gradient.js';
import ColorValues from '@/components/ColorValues.jsx';
import '@/styles/components/PrintColorCard.css';
export default function PrintColorCard( { item, settings } ) {
  const { t } = useTranslation();
  const gradient = item.type === 'gradient';
  const visible = ['hex', 'rgb', 'cmyk'].filter( ( format ) => settings[format] );
  return (
    <article className="print-color-card">
      <div
        className="print-swatch"
        style={ { background: gradient ? gradientCss( item ) : item.hex } }
        role="img"
        aria-label={ gradient ? t( 'gradient.preview' ) : item.hex }
      />
      { settings.names && item.name && <h3 title={ item.name }>{ item.name }</h3> }
      { gradient ? (
        <>
          <p className="print-direction">{ t( 'gradient.directions.' + item.direction ) }</p>
          { item.stops.map( ( stop, index ) => (
            <div key={ index } className="print-stop">
              <span>{ stop.position }%</span>
              <ColorValues hex={ stop.hex } visible={ visible } />
            </div>
          ) ) }
        </>
      ) : (
        <ColorValues hex={ item.hex } visible={ visible } />
      ) }
    </article>
  );
}
