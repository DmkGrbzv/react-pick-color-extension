import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_CODES } from '@/constants/errorCodes.js';
import { EXTENSION_PAGES } from '@/constants/extensionPages.js';
import { errorKey } from '@/utils/errors.js';
import { isSavedPalette } from '@/utils/paletteSnapshot.js';
import { usePalette } from '@/features/palette/hooks/usePalette.js';
import { useSavedPalettes } from '@/features/saved-palettes/hooks/useSavedPalettes.js';
import { useAppRoute } from '@/routes/useAppRoute.js';
import { useNavigationActions } from '@/routes/useNavigationActions.js';
import { appViewHash } from '@/routes/appRoutes.js';
import { apiUrl } from '@/api/config.js';
import MainLayout from '@/layouts/MainLayout.jsx';
import AppHeader from '@/components/common/AppHeader.jsx';
import AppNavigation from '@/components/common/AppNavigation.jsx';
import Icon from '@/components/ui/Icon.jsx';
import AccountMenu from '@/features/auth/components/AccountMenu.jsx';
import LanguageSelector from '@/features/preferences/components/LanguageSelector.jsx';
import ThemeToggle from '@/features/preferences/components/ThemeToggle.jsx';
import WorkingPalettePage from '@/pages/WorkingPalette/WorkingPalettePage.jsx';
import SavedPalettesPage from '@/pages/SavedPalettes/SavedPalettesPage.jsx';
import PrintPage from '@/pages/Print/PrintPage.jsx';
import './App.css';

export default function App( { panel = false, initialPage = 'working' } ) {
  const { t } = useTranslation();
  const { page, visited, navigate } = useAppRoute( initialPage );
  const { palette, error, retry } = usePalette();
  const library = useSavedPalettes( { enabled: Boolean( apiUrl ), loadLibrary: page === 'library' } );
  const { state, model } = library;
  const actions = useNavigationActions( page, navigate, model );
  const [workingRevision, setWorkingRevision] = useState( 0 );
  const busy = actions.opening || Boolean( state.busy );
  const unchanged = isSavedPalette( palette, state.user?.id );
  const title = page === 'library' ? t( 'library.libraryPageTitle' ) :
    page === 'print' ? t( 'print.title' ) : palette?.name ?? t( 'paletteName' );
  const pages = ['working', ...( apiUrl ? ['library'] : [] ), 'print'].map( ( view ) => ( {
    id: view,
    href: EXTENSION_PAGES.EDITOR + appViewHash( view ),
    label: t( 'navigation.' + ( view === 'library' ? 'saved' : view ) ),
    icon: view === 'print' ? 'print' : null,
  } ) );
  useEffect( () => { document.title = title; }, [title] );

  function opened() {
    setWorkingRevision( ( value ) => value + 1 );
    navigate( 'working' );
  }

  const header = <AppHeader panel={ panel } preferences={ <>
    <LanguageSelector compact={ panel } /><ThemeToggle />
  </> }>
    <h1>{ title }</h1>
    { page === 'working' && <p className="intro">{ t( panel ? 'brandIntro' : 'editorTitle' ) }</p> }
  </AppHeader>;
  const navigationActions = ( panel || apiUrl ) ? <>
    { panel && <button type="button" disabled={ actions.opening } onClick={ actions.expand }>
      <Icon name="external" />{ t( 'navigation.openFull' ) }
    </button> }
    { apiUrl && <>
      <button type="button" className="primary"
        disabled={ busy || !palette?.colors.length || Boolean( state.pending ) || unchanged }
        title={ unchanged ? t( 'library.unchanged' ) : undefined }
        onClick={ () => void actions.save() }>{ t( 'library.save' ) }</button>
      <AccountMenu user={ state.user } busy={ busy }
        onSignIn={ () => model.signIn() } onSignOut={ () => model.logout() } />
    </> }
  </> : null;
  const navigation = <AppNavigation page={ page } pages={ pages } onNavigate={ navigate } actions={ navigationActions } />;

  return (
    <MainLayout panel={ panel } view={ page } header={ header } navigation={ navigation }>
      { actions.failure && <p role="alert" className="error navigation-feedback">{ t( 'navigation.failed' ) }</p> }
      { page !== 'library' && ( state.error || state.stateError ) && <p role="alert" className="error navigation-feedback">{ t( 'navigation.accountFailed' ) }</p> }
      { page !== 'library' && state.busy && <p role="status" className="navigation-feedback">{ t( 'library.' + state.busy ) }</p> }
      { error && <div className="error palette-storage-error" role="alert">
        <p>{ t( errorKey( error, ERROR_CODES.STORAGE_FAILURE ) ) }</p>
        <button type="button" onClick={ retry }>{ t( 'retry' ) }</button>
      </div> }
      { !palette && !error && <p role="status">{ t( 'loading' ) }</p> }
      { visited.includes( 'working' ) && <section className="app-content" hidden={ page !== 'working' } aria-label={ t( 'navigation.working' ) }>
        <WorkingPalettePage key={ workingRevision } palette={ palette } panel={ panel } />
      </section> }
      { apiUrl && visited.includes( 'library' ) && <section className="app-content" hidden={ page !== 'library' } aria-label={ t( 'navigation.saved' ) }>
        <SavedPalettesPage palette={ palette } library={ library } onOpened={ opened } />
      </section> }
      { visited.includes( 'print' ) && <section className="app-content" hidden={ page !== 'print' } aria-label={ t( 'navigation.print' ) }>
        <PrintPage palette={ palette } />
      </section> }
    </MainLayout>
  );
}
