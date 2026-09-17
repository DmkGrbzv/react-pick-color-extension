import { colorValues, COLOR_FORMATS } from '@/utils/colorConversion.js';
import '@/styles/components/ColorValues.css';
export default function ColorValues( { hex, primary = 'hex', visible = COLOR_FORMATS } ) {
  const values = colorValues( hex );
  return (
    <dl className="color-values">
      { [primary, ...COLOR_FORMATS.filter( ( format ) => format !== primary )]
        .filter( ( format ) => visible.includes( format ) )
        .map( ( format ) => (
          <div key={ format } className={ format === primary ? 'primary-value' : '' }>
            <dt>{ format.toUpperCase() }</dt>
            <dd>{ values[format] }</dd>
          </div>
        ) ) }
    </dl>
  );
}
