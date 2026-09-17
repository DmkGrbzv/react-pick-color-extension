import '@/styles/components/PaletteList.css';
import { useTranslation } from 'react-i18next';
import ColorSwatch from '@/components/ColorSwatch.jsx';
import GradientCard from '@/components/GradientCard.jsx';
import EmptyPalette from '@/components/EmptyPalette.jsx';
export default function PaletteList( {
  palette,
  format = 'hex',
  editor,
  disabled,
  onCopy,
  onRemove,
  onEdit,
} ) {
  const { t } = useTranslation();

  return (
    <section aria-label={ t( 'currentPalette' ) }>
      <div className="section-heading">
        <h2>
          { t( 'gradient.items' ) } <span>{ palette.colors.length }</span>
        </h2>
        <span className="hint">{ t( 'savedLocally' ) }</span>
      </div>
      { palette.colors.length === 0 ? (
        <EmptyPalette editor={ editor } />
      ) : (
        <ul className="palette-grid">
          { palette.colors.map( ( item ) =>
            item.type === 'gradient' ? (
              <GradientCard
                key={ item.id }
                format={ format }
                item={ item }
                onCopy={ onCopy }
                onRemove={ onRemove }
                onEdit={ onEdit }
                disabled={ disabled }
              />
            ) : (
              <ColorSwatch
                key={ item.id }
                format={ format }
                color={ item }
                onCopy={ onCopy }
                onRemove={ onRemove }
                disabled={ disabled }
              />
            )
          ) }
        </ul>
      ) }
    </section>
  );
}
