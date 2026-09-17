import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openPrintPreview } from '@/api/printClient.js';
import '@/styles/components/PrintPreviewButton.css';
export default function PrintPreviewButton( { disabled } ) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState( false );
  const [failed, setFailed] = useState( false );
  async function open() {
    setBusy( true );
    setFailed( false );
    try {
      await openPrintPreview();
    } catch {
      setFailed( true );
    } finally {
      setBusy( false );
    }
  }
  return (
    <div className="print-preview-button">
      <button type="button" disabled={ disabled || busy } onClick={ open }>
        { t( 'print.open' ) }
      </button>
      { failed && (
        <p role="alert" className="error">
          { t( 'print.openFailed' ) }
        </p>
      ) }
    </div>
  );
}
