import { useTranslation } from 'react-i18next';
import { gradientCss, gradientDeclaration } from '../gradient';

export default function GradientCard( { item, onCopy, onRemove, onEdit, disabled } ) {
  const { t } = useTranslation();
  return (
    <li className="color-card gradient-card">
      <div
        className="swatch"
        style={ { background: gradientCss( item ) } }
        aria-label={ t( 'gradient.preview' ) }
        role="img"
      />
      <div className="color-details">
        { item.stops.map( ( stop, index ) => (
          <div className="gradient-stop-summary" key={ index }>
            <code>{ stop.hex }</code>
            <span>{ stop.position }%</span>
          </div>
        ) ) }
        <p className="hint">{ t( 'gradient.directions.' + item.direction ) }</p>
        <div className="color-actions">
          <button type="button" onClick={ () => onCopy( gradientDeclaration( item ), true ) }>
            { t( 'gradient.copyCss' ) }
          </button>
          <button type="button" disabled={ disabled } onClick={ () => onEdit( item ) }>
            { t( 'gradient.edit' ) }
          </button>
          <button
            type="button"
            className="delete"
            disabled={ disabled }
            onClick={ () => onRemove( item.id ) }
          >
            { t( 'remove' ) }
          </button>
        </div>
      </div>
    </li>
  );
}
