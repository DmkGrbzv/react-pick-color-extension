import { useTranslation } from 'react-i18next';
import './AppFooter.css';
import { appName } from '@/constants/branding.js';

export default function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="app-footer">
      { appName } <span>—</span> { t( 'tagline' ) }
    </footer>
  );
}
