import '@/styles/components/EmptyPalette.css';
import { useTranslation } from 'react-i18next';

export default function EmptyPalette( { editor } ) {
  const { t } = useTranslation();

  return (
    <div className="empty">
      <div className="empty-colors" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <h3>{ t( 'emptyTitle' ) }</h3>
      <p>{ t( editor ? 'gradient.emptyEditor' : 'emptyPanel' ) }</p>
    </div>
  );
}
