import '@/styles/components/PaletteHeader.css';
import { useTranslation } from 'react-i18next';
import AppHeader from '@/components/AppHeader.jsx';

export default function PaletteHeader( { editor, palette } ) {
  const { t } = useTranslation();

  return (
    <AppHeader panel={ !editor }>
      <h1>{ palette?.name ?? t( 'paletteName' ) }</h1>
      <p className="intro">{ t( editor ? 'editorTitle' : 'brandIntro' ) }</p>
    </AppHeader>
  );
}
