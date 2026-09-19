import { useTranslation } from 'react-i18next';
import '@/styles/components/AppFooter.css';

export default function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="app-footer">
      Big dq <span>—</span> { t( 'tagline' ) }
    </footer>
  );
}
