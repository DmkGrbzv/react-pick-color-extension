import PaletteApp from '@/components/PaletteApp.jsx';

export default function PaletteView( { editor = false } ) {
  return <PaletteApp panel={ !editor } />;
}
