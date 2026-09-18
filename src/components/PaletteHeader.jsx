import '@/styles/components/PaletteHeader.css';
import { useTranslation } from 'react-i18next';

export default function PaletteHeader( { editor, palette } ) {
  const { t } = useTranslation();

  return (
    <header>
      <p className="eyebrow">COLOR PALETTE / { t( editor ? 'editor' : 'eyedropper' ) }</p>
      <h1>{ palette?.name ?? t( 'paletteName' ) }</h1>
      <p className="intro">{ t( editor ? 'editorIntro' : 'panelIntro' ) }</p>
    </header>
  );
}
