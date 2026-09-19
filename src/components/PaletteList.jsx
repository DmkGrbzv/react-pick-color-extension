import Icon from '@/components/Icon.jsx';
import { useState } from 'react';
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
  const [advisorColorId, setAdvisorColorId] = useState( null );

  return (
    <section aria-label={ t( 'currentPalette' ) }>
      <div className="section-heading">
        <h2>
          { t( 'gradient.items' ) } <span>{ palette.colors.length }</span>
        </h2>
        <span className="hint saved-status">
          <Icon name="check" />
          { t( 'savedLocally' ) }
        </span>
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
                savedColors={ palette.colors }
                advisorOpen={ advisorColorId === item.id }
                onToggleAdvisor={ () =>
                  setAdvisorColorId( ( current ) => ( current === item.id ? null : item.id ) )
                }
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
