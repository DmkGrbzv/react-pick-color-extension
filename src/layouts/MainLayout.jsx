import AppFooter from '@/components/common/AppFooter.jsx';
import './MainLayout.css';

export default function MainLayout( { panel, view, header, navigation, children } ) {
  return (
    <main className={ 'app palette-app ' + ( panel ? 'panel' : 'editor' ) } data-view={ view }>
      { header }
      { navigation }
      { children }
      <AppFooter />
    </main>
  );
}
