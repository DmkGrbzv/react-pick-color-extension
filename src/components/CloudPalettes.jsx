import { useTranslation } from 'react-i18next';
import { paletteVersion, isSavedPalette } from '@/cloud/snapshot.js';
import CloudSaveConfirmation from '@/components/CloudSaveConfirmation.jsx';
import CloudPalettePreview from '@/components/CloudPalettePreview.jsx';
import CloudPaletteDetails from '@/components/CloudPaletteDetails.jsx';
import '@/styles/components/CloudPalettes.css';

const errorCodes = new Set( [
  'unauthorized', 'authCancelled', 'authConfiguration', 'authFlowFailed', 'invalidIdentity', 'invalidAuthRequest',
  'paletteLimit', 'saveConflict', 'paletteChanged', 'sessionChanged', 'rateLimited',
  'invalidPalette', 'cloudBusy', 'logoutUnconfirmed', 'snapshotDeleted', 'paletteUnchanged',
] );

export default function CloudPalettes( { palette, cloud, onOpened } ) {
  const { t, i18n } = useTranslation();
  const { state, model } = cloud;
  const busy = Boolean( state.busy );
  const pending = state.pending;
  const unchanged = isSavedPalette( palette, state.user?.id );
  const error = state.error || state.libraryError || state.stateError;

  async function open( id ) {
    if ( !palette ) return;
    // Capture before the confirmation, then compare again inside the worker queue.
    const version = paletteVersion( palette );
    if ( palette.colors.length && !window.confirm( t( 'cloud.replace' ) ) ) return;
    if ( await model.open( id, version ) ) onOpened?.();
  }

  function remove( item ) {
    const name = item.name || t( 'cloud.unnamed' );
    if ( window.confirm( t( 'cloud.deleteConfirm', { name } ) ) ) void model.remove( item.id );
  }

  return (
    <>
      { palette && <p className="hint">{ t( 'cloud.currentWorking', {
        name: palette.name, count: palette.colors.length,
      } ) }</p> }
    <section className="cloud-palettes" aria-label={ t( 'cloud.title' ) }>
      <h2>{ t( 'cloud.title' ) }</h2>
      <p className="hint">{ t( state.user ? 'cloud.signedInHint' : 'cloud.guestHint' ) }</p>
      { pending && <CloudSaveConfirmation key={ pending.key } pending={ pending } user={ state.user } busy={ busy }
        onSave={ ( name ) => model.save( name ) } onCancel={ () => void model.cancel() } /> }
      { unchanged && <p className="hint">{ t( 'cloud.unchanged' ) }</p> }
      { state.busy && <p role="status">{ t( 'cloud.' + state.busy ) }</p> }
      { error && <p role="alert" className="error">
        { t( 'cloud.errors.' + ( errorCodes.has( error.code ) ? error.code : 'cloudFailed' ) ) }
      </p> }
      { ( state.libraryError || state.stateError ) && <button type="button" disabled={ state.loading || busy }
        onClick={ () => void model.refresh( true ) }>{ t( 'cloud.retryLibrary' ) }</button> }
      { state.notice && <p role="status" className="success">{ t( 'cloud.' + state.notice ) }</p> }
      { state.user && (
        <>
          { !state.loading && !state.libraryError && !state.stateError && !state.palettes.length && <p>{ t( 'cloud.empty' ) }</p> }
          <ul className="cloud-library">
            { state.palettes.map( ( item ) => (
              <li key={ item.id }>
                <h3>{ item.name || t( 'cloud.unnamed' ) }</h3>
                <CloudPalettePreview items={ item.items } />
                <p>{ t( 'cloud.count', { count: item.items.length } ) }</p>
                <time dateTime={ item.createdAt }>{ new Date( item.createdAt ).toLocaleString( i18n.language ) }</time>
                <div className="cloud-actions">
                  <button type="button" disabled={ busy } onClick={ () => void model.details( item.id ) }>{ t( 'cloud.details' ) }</button>
                  <button type="button" disabled={ busy || !palette } onClick={ () => open( item.id ) }>{ t( 'cloud.open' ) }</button>
                  <button type="button" className="cloud-delete" disabled={ busy }
                    onClick={ () => remove( item ) }>{ t( 'cloud.delete' ) }</button>
                </div>
              </li>
            ) ) }
          </ul>
          { state.loading && <p role="status">{ t( 'cloud.loading' ) }</p> }
          { state.nextCursor && <button type="button" disabled={ state.loading }
            onClick={ () => void model.loadMore() }>{ t( 'cloud.more' ) }</button> }
        </>
      ) }
      { state.detail && <CloudPaletteDetails key={ state.detail.id + state.detail.name }
        palette={ state.detail } busy={ busy }
        onRename={ ( name ) => model.rename( state.detail.id, name ) }
        onOpen={ () => open( state.detail.id ) } onRemove={ () => remove( state.detail ) }
        onClose={ () => model.closeDetails() } /> }
    </section>
    </>
  );
}
