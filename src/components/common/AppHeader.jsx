import { useTranslation } from 'react-i18next';
import Icon from '@/components/ui/Icon.jsx';
import './AppHeader.css';

export default function AppHeader( { children, preferences, panel = false } ) {
  const { t } = useTranslation();
  return (
    <header className="app-header">
      <div className="app-brand">
        { panel && (
          <span className="app-mark">
            <Icon name="eyedropper" />
          </span>
        ) }
        <div className="app-brand-text">{ children || <strong>Big dq</strong> }</div>
      </div>
      <div className="app-preferences" aria-label={ t( 'appearance' ) }>
        { preferences }
      </div>
    </header>
  );
}
