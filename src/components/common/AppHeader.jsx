import { useTranslation } from 'react-i18next';
import { appName } from '@/constants/branding.js';
import './AppHeader.css';

export default function AppHeader( { children, preferences, panel = false } ) {
  const { t } = useTranslation();
  return (
    <header className="app-header">
      <div className="app-brand">
        <img className="app-mark" src="./icons/pickment-128.png" width={ panel ? 32 : 38 } height={ panel ? 32 : 38 } alt={ appName } />
        <div className="app-brand-text">{ children || <strong>{ appName }</strong> }</div>
      </div>
      <div className="app-preferences" aria-label={ t( 'appearance' ) }>
        { preferences }
      </div>
    </header>
  );
}
