import { useState } from 'react';
import { DEFAULT_PRINT_SETTINGS } from '@/features/printing/utils/printLayout.js';
import PrintControls from '@/features/printing/components/PrintControls.jsx';
import PrintDocument from '@/features/printing/components/PrintDocument.jsx';
import './PrintPage.css';

export default function PrintPage( { palette } ) {
  const [settings, setSettings] = useState( DEFAULT_PRINT_SETTINGS );
  return (
    <div className="print-preview">
      <style>{ '@page { size: A4 ' + settings.orientation + '; margin: 0; }' }</style>
      <PrintControls settings={ settings } onChange={ setSettings } disabled={ !palette } />
      { palette && <PrintDocument palette={ palette } settings={ settings } /> }
    </div>
  );
}
