import { useState } from 'react';
import { DEFAULT_PRINT_SETTINGS } from '@/utils/printLayout.js';
import PrintControls from '@/components/PrintControls.jsx';
import PrintDocument from '@/components/PrintDocument.jsx';
import '@/styles/pages/PrintPreview.css';

export default function PrintWorkspace( { palette } ) {
  const [settings, setSettings] = useState( DEFAULT_PRINT_SETTINGS );
  return (
    <div className="print-preview">
      <style>{ '@page { size: A4 ' + settings.orientation + '; margin: 0; }' }</style>
      <PrintControls settings={ settings } onChange={ setSettings } disabled={ !palette } />
      { palette && <PrintDocument palette={ palette } settings={ settings } /> }
    </div>
  );
}
