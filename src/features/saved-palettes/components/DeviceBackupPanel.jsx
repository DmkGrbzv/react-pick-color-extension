import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '@/extension/messaging/sendRequest.js';
import { paletteVersion } from '@/utils/paletteSnapshot.js';
import { gradientDeclaration } from '@/utils/gradient.js';
import { BACKUP_KEY } from '../utils/deviceBackupValidation.js';
import SavedPalettePreview from './SavedPalettePreview.jsx';
import './SavedPalettes.css';

export default function DeviceBackupPanel( { signedIn, palette, onOpened, captureEnabled = true } ) {
  const { t, i18n } = useTranslation();
  const [backup, setBackup] = useState( null );
  const [page, setPage] = useState( 0 );
  const [visible, setVisible] = useState( false );
  const [busy, setBusy] = useState( false );
  const [notice, setNotice] = useState( '' );
  const [error, setError] = useState( '' );
  const active = useRef( true );
  const pending = useRef( false );
  const operation = useRef( 0 );
  const readVersion = useRef( 0 );
  useEffect( () => { active.current = true; return () => { active.current = false; }; }, [] );

  useEffect( () => {
    const changed = ( changes, area ) => {
      if ( area !== 'local' || !Object.hasOwn( changes, BACKUP_KEY ) ) return;
      readVersion.current++;
      setBackup( null ); setVisible( false );
    };
    const events = globalThis.chrome?.storage?.onChanged;
    events?.addListener( changed );
    return () => events?.removeListener( changed );
  }, [] );

  async function perform( action, interrupt = false ) {
    if ( pending.current && !interrupt ) return;
    const revision = ++operation.current;
    const current = () => active.current && revision === operation.current;
    pending.current = true;
    setBusy( true ); setError( '' ); setNotice( '' );
    try { await action( current ); }
    catch ( failure ) {
      if ( current() ) setError( ['unauthorized', 'sessionChanged', 'backupStorageFailed', 'invalidBackup', 'paletteChanged', 'cloudBusy'].includes( failure.code ) ? failure.code : 'failed' );
    } finally {
      if ( current() ) { pending.current = false; setBusy( false ); }
    }
  }
  function create() {
    if ( !window.confirm( t( 'backup.confirm' ) ) ) return;
    void perform( async ( current ) => {
      await sendRequest( { type: 'backup:create' } );
      if ( current() ) { setBackup( null ); setVisible( false ); setNotice( 'saved' ); }
    } );
  }
  function view() {
    void perform( async ( current ) => {
      const version = readVersion.current;
      const value = await sendRequest( { type: 'backup:read' } );
      if ( current() && version === readVersion.current ) { setBackup( value ); setPage( 0 ); setVisible( true ); }
    } );
  }
  function remove() {
    if ( !window.confirm( t( 'backup.deleteConfirm' ) ) ) return;
    void perform( async ( current ) => {
      await sendRequest( { type: 'backup:remove' } );
      if ( current() ) { setBackup( null ); setVisible( false ); setNotice( 'deleted' ); }
    }, true );
  }
  function open( index ) {
    const version = paletteVersion( palette );
    if ( palette.colors.length && !window.confirm( t( 'library.replace' ) ) ) return;
    void perform( async ( current ) => {
      await sendRequest( { type: 'backup:open', createdAt: backup.createdAt, index, expectedVersion: version } );
      if ( current() ) onOpened?.();
    } );
  }
  function copy( item ) {
    void perform( async ( current ) => {
      await navigator.clipboard.writeText( item.type === 'gradient' ? gradientDeclaration( item ) : item.hex );
      if ( current() ) setNotice( 'copied' );
    } );
  }
  return (
    <section className="saved-palettes" aria-label={ t( 'backup.title' ) }>
      <h2>{ t( 'backup.title' ) }</h2>
      <p className="hint">{ t( 'backup.explanation' ) }</p>
      { captureEnabled && <p className="hint">{ t( 'backup.captureHint' ) }</p> }
      <div className="saved-actions">
        { captureEnabled && <button type="button" disabled={ busy || !signedIn } onClick={ create }>{ t( 'backup.create' ) }</button> }
        <button type="button" disabled={ busy } onClick={ view }>{ t( 'backup.view' ) }</button>
        <button type="button" onClick={ remove }>{ t( 'backup.delete' ) }</button>
      </div>
      { busy && <p role="status">{ t( 'backup.busy' ) }</p> }
      { error && <p role="alert" className="error">{ t( 'backup.errors.' + error ) }</p> }
      { notice && <p role="status">{ t( 'backup.' + notice ) }</p> }
      { visible && !backup && <p>{ t( 'backup.empty' ) }</p> }
      { visible && backup && <>
        <p>{ t( 'backup.count', { count: backup.count } ) } — <time dateTime={ backup.createdAt }>{ new Date( backup.createdAt ).toLocaleString( i18n.language ) }</time></p>
        <ul className="saved-library">{ backup.palettes.slice( page * 4, page * 4 + 4 ).map( ( entry, index ) => <li key={ index }>
          <h3>{ entry.name }</h3>
          <SavedPalettePreview items={ entry.items } />
          <p>{ t( 'library.count', { count: entry.items.length } ) }</p>
          <div className="saved-actions">
            <button type="button" disabled={ busy || !palette } onClick={ () => open( index + page * 4 ) }>{ t( 'library.open' ) }</button>
            { entry.items.map( ( item, itemIndex ) => <button type="button" key={ itemIndex } disabled={ busy }
              onClick={ () => copy( item ) }>{ item.type === 'gradient' ? t( 'backup.copyGradient' ) : item.hex }</button> ) }
          </div>
        </li> ) }</ul>
        <div className="saved-actions">
          <button type="button" disabled={ busy || page === 0 } onClick={ () => setPage( page - 1 ) }>{ t( 'backup.previous' ) }</button>
          <button type="button" disabled={ busy || ( page + 1 ) * 4 >= backup.count } onClick={ () => setPage( page + 1 ) }>{ t( 'backup.next' ) }</button>
        </div>
      </> }
    </section>
  );
}
