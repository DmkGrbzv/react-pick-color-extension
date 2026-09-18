import { ERROR_CODES } from '@/constants/errorCodes.js';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePalette } from '@/usePalette.js';
import { errorKey } from '@/errors.js';
import { DEFAULT_PRINT_SETTINGS } from '@/utils/printLayout.js';
import PrintControls from '@/components/PrintControls.jsx';
import PrintDocument from '@/components/PrintDocument.jsx';
import LanguageSelector from '@/components/LanguageSelector.jsx';
import '@/styles/pages/PrintPreview.css';
export default function PrintPreview() {
  const { t } = useTranslation();
  const { palette, error, retry } = usePalette();
  const [settings, setSettings] = useState( DEFAULT_PRINT_SETTINGS );
  useEffect( () => {
    document.title = t( 'print.title' );
  }, [t] );
  return (
    <main className="print-preview">
      <style>{ '@page { size: A4 ' + settings.orientation + '; margin: 0; }' }</style>
      <div className="print-screen-header">
        <LanguageSelector />
      </div>
      <PrintControls
        settings={ settings }
        onChange={ setSettings }
        disabled={ !palette || Boolean( error ) }
      />
      { error ? (
        <div className="error" role="alert">
          <p>{ t( errorKey( error, ERROR_CODES.STORAGE_FAILURE ) ) }</p>
          <button onClick={ retry }>{ t( 'retry' ) }</button>
        </div>
      ) : !palette ? (
        <p role="status">{ t( 'loading' ) }</p>
      ) : (
        <PrintDocument palette={ palette } settings={ settings } />
      ) }
    </main>
  );
}
