import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_CODES } from '@/constants/errorCodes.js';
import { errorKey } from '@/errors.js';
import { usePalette } from '@/usePalette.js';
import { useAppRoute } from '@/hooks/useAppRoute.js';
import { useCloudLibrary } from '@/hooks/useCloudLibrary.js';
import { cloudApiUrl } from '@/cloud/config.js';
import AppHeader from '@/components/AppHeader.jsx';
import AppNavigation from '@/components/AppNavigation.jsx';
import AppFooter from '@/components/AppFooter.jsx';
import WorkingPalette from '@/components/WorkingPalette.jsx';
import CloudPalettes from '@/components/CloudPalettes.jsx';
import PrintWorkspace from '@/components/PrintWorkspace.jsx';
import '@/styles/pages/PaletteView.css';
import '@/styles/components/PaletteHeader.css';
import '@/styles/pages/PaletteApp.css';

export default function PaletteApp( { panel = false, initialPage = 'working' } ) {
  const { t } = useTranslation();
  const { page, visited, navigate } = useAppRoute( initialPage );
  const { palette, error, retry } = usePalette();
  const cloud = useCloudLibrary( { enabled: Boolean( cloudApiUrl ), loadLibrary: page === 'library' } );
  const [workingRevision, setWorkingRevision] = useState( 0 );
  const title = page === 'library' ? t( 'cloud.libraryPageTitle' ) :
    page === 'print' ? t( 'print.title' ) : palette?.name ?? t( 'paletteName' );
  useEffect( () => { document.title = title; }, [title] );
  function opened() {
    setWorkingRevision( ( value ) => value + 1 );
    navigate( 'working' );
  }

  return (
    <main className={ 'app palette-app ' + ( panel ? 'panel' : 'editor' ) } data-view={ page }>
      <AppHeader panel={ panel }>
        <h1>{ title }</h1>
        { page === 'working' && <p className="intro">{ t( panel ? 'brandIntro' : 'editorTitle' ) }</p> }
      </AppHeader>
      <AppNavigation page={ page } panel={ panel } palette={ palette } cloud={ cloud } onNavigate={ navigate } />
      { error && <div className="error palette-storage-error" role="alert">
        <p>{ t( errorKey( error, ERROR_CODES.STORAGE_FAILURE ) ) }</p>
        <button type="button" onClick={ retry }>{ t( 'retry' ) }</button>
      </div> }
      { !palette && !error && <p role="status">{ t( 'loading' ) }</p> }
      { visited.includes( 'working' ) && <section className="app-content" hidden={ page !== 'working' } aria-label={ t( 'navigation.working' ) }>
        <WorkingPalette key={ workingRevision } palette={ palette } panel={ panel } />
      </section> }
      { cloudApiUrl && visited.includes( 'library' ) && <section className="app-content" hidden={ page !== 'library' } aria-label={ t( 'navigation.saved' ) }>
        <CloudPalettes palette={ palette } cloud={ cloud } onOpened={ opened } />
      </section> }
      { visited.includes( 'print' ) && <section className="app-content" hidden={ page !== 'print' } aria-label={ t( 'navigation.print' ) }>
        <PrintWorkspace palette={ palette } />
      </section> }
      <AppFooter />
    </main>
  );
}
