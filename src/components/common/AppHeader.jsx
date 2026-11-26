import { useTranslation } from 'react-i18next';
import { appName } from '@/constants/branding.js';
import './AppHeader.css';

export default function AppHeader( { children, preferences, panel = false } ) {
  const { t } = useTranslation();
  return (
    <header className="app-header">
      <div className="app-brand">
        { appName === 'Tintoom'
          ? (
            <span className="app-logo">
              <img src="./icons/tintoom-logo.png" width={ panel ? 160 : 176 } height={ panel ? 40 : 44 } alt={ appName } />
            </span>
          )
          : <strong>{ appName }</strong> }
        <div className="app-brand-text">{ children }</div>
      </div>
      <div className="app-preferences" aria-label={ t( 'appearance' ) }>
        { preferences }
      </div>
    </header>
  );
}
