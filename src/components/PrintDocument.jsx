import { useTranslation } from 'react-i18next';
import { paginateItems, printLayout } from '@/utils/printLayout.js';
import PrintColorCard from '@/components/PrintColorCard.jsx';
import '@/styles/components/PrintDocument.css';
export default function PrintDocument( { palette, settings } ) {
  const { t } = useTranslation();
  const layout = printLayout( settings );
  const pages = paginateItems( palette.colors, settings );
  return (
    <div
      className="print-document"
      style={ {
        '--sheet-width': layout.width + 'mm',
        '--sheet-height': layout.height + 'mm',
        '--print-columns': layout.columns,
        '--print-rows': layout.rows,
        '--paper': settings.background === 'warm' ? '#fffdf5' : '#fff',
      } }
    >
      { pages.map( ( items, index ) => (
        <section className="print-page" key={ index }>
          <header>
            <h2>{ palette.id === 'current' ? t( 'paletteName' ) : palette.name }</h2>
          </header>
          <div className="print-color-grid">
            { items.map( ( item ) => (
              <PrintColorCard key={ item.id } item={ item } settings={ settings } />
            ) ) }
            { !items.length && <p>{ t( 'emptyTitle' ) }</p> }
          </div>
          <footer>
            <span>{ settings.cmyk ? t( 'print.approximate' ) : '' }</span>
            <span>{ t( 'print.page', { current: index + 1, total: pages.length } ) }</span>
          </footer>
        </section>
      ) ) }
    </div>
  );
}
