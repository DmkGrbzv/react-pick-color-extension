import { useTranslation } from 'react-i18next';
import Icon from '@/components/Icon.jsx';
import LanguageSelector from '@/components/LanguageSelector.jsx';
import ThemeToggle from '@/components/ThemeToggle.jsx';
import '@/styles/components/AppHeader.css';

export default function AppHeader( { children, panel = false } ) {
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
        <LanguageSelector compact={ panel } />
        <ThemeToggle />
      </div>
    </header>
  );
}
