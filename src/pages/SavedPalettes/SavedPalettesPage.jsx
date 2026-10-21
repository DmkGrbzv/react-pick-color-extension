import { useTranslation } from 'react-i18next';
import { paletteVersion, isSavedPalette } from '@/utils/paletteSnapshot.js';
import SavePaletteConfirmation from '@/features/saved-palettes/components/SavePaletteConfirmation.jsx';
import SavedPalettePreview from '@/features/saved-palettes/components/SavedPalettePreview.jsx';
import SavedPaletteDetails from '@/features/saved-palettes/components/SavedPaletteDetails.jsx';
import './SavedPalettesPage.css';

const errorCodes = new Set( [
  'unauthorized', 'authCancelled', 'authConfiguration', 'authFlowFailed', 'invalidIdentity', 'invalidAuthRequest',
  'paletteLimit', 'saveConflict', 'paletteChanged', 'sessionChanged', 'rateLimited',
  'invalidPalette', 'cloudBusy', 'logoutUnconfirmed', 'snapshotDeleted', 'paletteUnchanged',
] );

export default function SavedPalettesPage( { palette, library, onOpened } ) {
  const { t, i18n } = useTranslation();
  const { state, model } = library;
  const busy = Boolean( state.busy );
  const pending = state.pending;
  const unchanged = isSavedPalette( palette, state.user?.id );
  const error = state.error || state.libraryError || state.stateError;

  async function open( id ) {
    if ( !palette ) return;
    // Capture before the confirmation, then compare again inside the worker queue.
    const version = paletteVersion( palette );
    if ( palette.colors.length && !window.confirm( t( 'library.replace' ) ) ) return;
    if ( await model.open( id, version ) ) onOpened?.();
  }

  function remove( item ) {
    const name = item.name || t( 'library.unnamed' );
    if ( window.confirm( t( 'library.deleteConfirm', { name } ) ) ) void model.remove( item.id );
  }

  return (
    <>
      { palette && <p className="hint">{ t( 'library.currentWorking', {
        name: palette.name, count: palette.colors.length,
      } ) }</p> }
    <section className="saved-palettes" aria-label={ t( 'library.title' ) }>
      <h2>{ t( 'library.title' ) }</h2>
      <p className="hint">{ t( state.user ? 'library.signedInHint' : 'library.guestHint' ) }</p>
      { pending && <SavePaletteConfirmation key={ pending.key } pending={ pending } user={ state.user } busy={ busy }
        onSave={ ( name ) => model.save( name ) } onCancel={ () => void model.cancel() } /> }
      { unchanged && <p className="hint">{ t( 'library.unchanged' ) }</p> }
      { state.busy && <p role="status">{ t( 'library.' + state.busy ) }</p> }
      { error && <p role="alert" className="error">
        { t( 'library.errors.' + ( errorCodes.has( error.code ) ? error.code : 'cloudFailed' ) ) }
      </p> }
      { ( state.libraryError || state.stateError ) && <button type="button" disabled={ state.loading || busy }
        onClick={ () => void model.refresh( true ) }>{ t( 'library.retryLibrary' ) }</button> }
      { state.notice && <p role="status" className="success">{ t( 'library.' + state.notice ) }</p> }
      { state.user && (
        <>
          { !state.loading && !state.libraryError && !state.stateError && !state.palettes.length && <p>{ t( 'library.empty' ) }</p> }
          <ul className="saved-library">
            { state.palettes.map( ( item ) => (
              <li key={ item.id }>
                <h3>{ item.name || t( 'library.unnamed' ) }</h3>
                <SavedPalettePreview items={ item.items } />
                <p>{ t( 'library.count', { count: item.items.length } ) }</p>
                <time dateTime={ item.createdAt }>{ new Date( item.createdAt ).toLocaleString( i18n.language ) }</time>
                <div className="saved-actions">
                  <button type="button" disabled={ busy } onClick={ () => void model.details( item.id ) }>{ t( 'library.details' ) }</button>
                  <button type="button" disabled={ busy || !palette } onClick={ () => open( item.id ) }>{ t( 'library.open' ) }</button>
                  <button type="button" className="saved-delete" disabled={ busy }
                    onClick={ () => remove( item ) }>{ t( 'library.delete' ) }</button>
                </div>
              </li>
            ) ) }
          </ul>
          { state.loading && <p role="status">{ t( 'library.loading' ) }</p> }
          { state.nextCursor && <button type="button" disabled={ state.loading }
            onClick={ () => void model.loadMore() }>{ t( 'library.more' ) }</button> }
        </>
      ) }
      { state.detail && <SavedPaletteDetails key={ state.detail.id + state.detail.name }
        palette={ state.detail } busy={ busy }
        onRename={ ( name ) => model.rename( state.detail.id, name ) }
        onOpen={ () => open( state.detail.id ) } onRemove={ () => remove( state.detail ) }
        onClose={ () => model.closeDetails() } /> }
    </section>
    </>
  );
}
