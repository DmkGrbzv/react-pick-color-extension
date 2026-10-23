import { useTranslation } from 'react-i18next';
import Icon from '@/components/ui/Icon.jsx';
import './AppNavigation.css';

export default function AppNavigation( { page, pages, onNavigate, actions } ) {
  const { t } = useTranslation();

  function visit( event, view ) {
    if ( event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ) return;
    event.preventDefault();
    onNavigate( view );
  }

  return (
    <div className="app-navigation-container">
    <nav className="app-navigation" aria-label={ t( 'navigation.label' ) }>
      <div className="app-navigation-pages">
        { pages.map( ( item ) => (
          <a key={ item.id } href={ item.href } data-tooltip={ item.label } aria-label={ item.label }
            onClick={ ( event ) => visit( event, item.id ) }
            aria-current={ page === item.id ? 'page' : undefined }>
            { item.icon && <Icon name={ item.icon } /> }
            <span className="navigation-label">{ item.label }</span>
          </a>
        ) ) }
      </div>
      { actions && <div className="app-navigation-actions">{ actions }</div> }
    </nav>
    </div>
  );
}
