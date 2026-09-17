import '@/styles/components/PaletteItems.css';
import { useTranslation } from 'react-i18next';
import { createGradientDraft, updateGradientDraft } from '@/gradient.js';
import { useGradientEditor } from '@/hooks/useGradientEditor.js';
import GradientBuilder from '@/components/GradientBuilder.jsx';
import PaletteList from '@/components/PaletteList.jsx';

export default function PaletteItems( {
  palette,
  format = 'hex',
  editor,
  busy,
  onCopy,
  onRemove,
  onEditInPanel,
} ) {
  const { t } = useTranslation();
  const {
    draft,
    setDraft,
    expanded,
    setExpanded,
    working,
    notice,
    setNotice,
    container,
    edit,
    pick,
    save,
    cancel,
  } = useGradientEditor( palette, editor );

  return (
    <>
      { editor && (
        <div ref={ container } className="gradient-workspace">
          { !expanded && (
            <button
              type="button"
              className="primary"
              onClick={ () => {
                setDraft( createGradientDraft() );
                setExpanded( true );
                setNotice( null );
              } }
            >
              { t( 'gradient.create' ) }
            </button>
          ) }
          { expanded && (
            <GradientBuilder
              draft={ draft }
              onChange={ ( action ) => {
                setDraft( ( value ) => updateGradientDraft( value, action ) );
                setNotice( null );
              } }
              onPick={ pick }
              onSave={ save }
              onCancel={ cancel }
              busy={ working || busy }
              notice={ notice }
              colors={ palette.colors.filter( ( item ) => item.type !== 'gradient' ) }
            />
          ) }
          { !expanded && notice && (
            <p role="status" className={ notice.error ? 'error' : 'success' }>
              { t( notice.key ) }
            </p>
          ) }
        </div>
      ) }
      <PaletteList
        format={ format }
        palette={ palette }
        editor={ editor }
        disabled={ busy || working }
        onCopy={ onCopy }
        onRemove={ onRemove }
        onEdit={ editor ? edit : onEditInPanel }
      />
    </>
  );
}
