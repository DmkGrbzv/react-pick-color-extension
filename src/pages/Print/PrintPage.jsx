import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '@/components/ui/Icon.jsx';
import { DEFAULT_PRINT_SETTINGS, printLayout } from '@/features/printing/utils/printLayout.js';
import PrintControls from '@/features/printing/components/PrintControls.jsx';
import PrintDocument from '@/features/printing/components/PrintDocument.jsx';
import { usePrintPreviewWidth } from './usePrintPreviewWidth.js';
import './PrintPage.css';

const MIN_PREVIEW_WIDTH = 820;
const PREVIEW_PADDING = 16;
const PIXELS_PER_MM = 96 / 25.4;

export default function PrintPage( { palette, panel = false, onOpenFull, opening } ) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState( DEFAULT_PRINT_SETTINGS );
  const { container, width } = usePrintPreviewWidth();
  const narrow = width !== null && width < MIN_PREVIEW_WIDTH;
  const scale = width === null ? 1 : Math.min( 1,
    Math.max( 0, width - PREVIEW_PADDING ) / ( printLayout( settings ).width * PIXELS_PER_MM ) );
  return (
    <div ref={ container } className="print-preview" style={ { '--print-preview-scale': scale } }>
      <style>{ '@page { size: A4 ' + settings.orientation + '; margin: 0; }' }</style>
      <section className="print-full-view-hint" hidden={ !narrow } aria-label={ t( 'print.title' ) }>
        <h2>{ t( 'print.title' ) }</h2>
        <p>{ t( panel ? 'print.fullViewHint' : 'print.widenHint' ) }</p>
        { panel && <button type="button" className="primary" disabled={ opening } onClick={ onOpenFull }>
          <Icon name="external" />{ t( 'navigation.openFull' ) }
        </button> }
      </section>
      <div className="print-preview-content" hidden={ narrow }>
        <PrintControls settings={ settings } onChange={ setSettings } disabled={ !palette || narrow } />
        { palette && <PrintDocument palette={ palette } settings={ settings } /> }
      </div>
    </div>
  );
}
