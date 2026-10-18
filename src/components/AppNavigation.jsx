import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EXTENSION_PAGES } from '@/constants/extensionPages.js';
import { appViewHash } from '@/navigation/appRoutes.js';
import { openEditor } from '@/api/editorClient.js';
import { cloudApiUrl } from '@/cloud/config.js';
import { isSavedPalette } from '@/cloud/snapshot.js';
import Icon from '@/components/Icon.jsx';
import AccountMenu from '@/components/AccountMenu.jsx';
import '@/styles/components/AppNavigation.css';

export default function AppNavigation( { page, panel, palette, cloud, onNavigate } ) {
  const { t } = useTranslation();
  const { state, model } = cloud;
  const [opening, setOpening] = useState( false );
  const [failure, setFailure] = useState( null );
  const busy = opening || Boolean( state.busy );
  const unchanged = isSavedPalette( palette, state.user?.id );

  function visit( event, view ) {
    if ( event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ) return;
    event.preventDefault();
    onNavigate( view );
  }

  async function expand() {
    if ( opening ) return;
    setOpening( true );
    setFailure( null );
    try {
      await openEditor( undefined, page );
    } catch ( error ) {
      setFailure( error );
    } finally {
      setOpening( false );
    }
  }

  async function save() {
    const prepared = await model.prepare();
    if ( prepared?.pending ) onNavigate( 'library' );
  }

  return (
    <>
      <nav className="app-navigation" aria-label={ t( 'navigation.label' ) }>
        <div className="app-navigation-pages">
          { ['working', ...( cloudApiUrl ? ['library'] : [] ), 'print'].map( ( view ) => (
            <a key={ view } href={ EXTENSION_PAGES.EDITOR + appViewHash( view ) }
              onClick={ ( event ) => visit( event, view ) } aria-current={ page === view ? 'page' : undefined }>
              { view === 'print' && <Icon name="print" /> }
              { t( 'navigation.' + ( view === 'library' ? 'saved' : view ) ) }
            </a>
          ) ) }
        </div>
        { ( panel || cloudApiUrl ) && <div className="app-navigation-actions">
          { panel && <button type="button" disabled={ opening } onClick={ expand }>
            <Icon name="external" />{ t( 'navigation.openFull' ) }
          </button> }
          { cloudApiUrl && <>
            <button type="button" className="primary" disabled={ busy || !palette?.colors.length || Boolean( state.pending ) || unchanged }
              title={ unchanged ? t( 'cloud.unchanged' ) : undefined } onClick={ () => void save() }>{ t( 'cloud.save' ) }</button>
            <AccountMenu user={ state.user } busy={ busy } onSignIn={ () => model.signIn() } onSignOut={ () => model.logout() } />
          </> }
        </div> }
      </nav>
      { failure && <p role="alert" className="error navigation-feedback">{ t( 'navigation.failed' ) }</p> }
      { page !== 'library' && ( state.error || state.stateError ) && <p role="alert" className="error navigation-feedback">{ t( 'navigation.accountFailed' ) }</p> }
      { page !== 'library' && state.busy && <p role="status" className="navigation-feedback">{ t( 'cloud.' + state.busy ) }</p> }
    </>
  );
}
