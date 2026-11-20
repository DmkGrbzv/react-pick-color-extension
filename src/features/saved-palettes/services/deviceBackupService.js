import { AppError } from '@/utils/errors.js';
import { restorePaletteSnapshot } from '@/utils/paletteSnapshot.js';
import { BACKUP_KEY, MAX_BACKUP_BYTES, MAX_BACKUP_PALETTES, exactBackupKeys, validateBackupRecord, validateDeviceBackup } from '../utils/deviceBackupValidation.js';

export class DeviceBackupService {
  #storage;
  #store;
  #http;
  #palette;
  #busy = false;
  #generation = 0;
  #controller;
  #signal;
  #tail = Promise.resolve();
  constructor( { storage, store, http, palette } ) {
    this.#storage = storage; this.#store = store; this.#http = http; this.#palette = palette;
  }
  #mutate( task ) {
    const operation = this.#tail.catch( () => {} ).then( task );
    this.#tail = operation;
    return operation;
  }
  cancel() {
    this.#generation++;
    this.#controller?.abort();
  }
  async read() {
    await this.#storage.initialize();
    const value = ( await this.#storage.readPersistent( BACKUP_KEY ) )[BACKUP_KEY];
    return value === undefined ? null : validateDeviceBackup( value );
  }
  remove() {
    this.cancel();
    return this.#mutate( async () => {
      await this.#storage.initialize();
      await this.#storage.removePersistent( BACKUP_KEY );
    } );
  }
  async #assertCapture( session, epoch, generation ) {
    if ( generation !== this.#generation || this.#signal?.aborted ) throw new AppError( 'sessionChanged' );
    await this.#store.assertEpoch( epoch );
    await this.#store.assertSession( session );
  }
  async create() {
    if ( this.#busy ) throw new AppError( 'cloudBusy' );
    this.#busy = true;
    const generation = this.#generation;
    this.#controller = new AbortController();
    try {
      if ( !this.#http ) throw new AppError( 'cloudUnavailable' );
      const session = await this.#store.session();
      if ( !session ) throw new AppError( 'unauthorized' );
      const epoch = await this.#store.epoch();
      const signal = this.#signal = AbortSignal.any( [this.#controller.signal, AbortSignal.timeout( 120_000 )] );
      const palettes = [];
      const cursors = new Set();
      const ids = new Set();
      let cursor = null;
      for ( let pageNumber = 0; pageNumber < 20; pageNumber++ ) {
        await this.#assertCapture( session, epoch, generation );
        const page = await this.#http.request( '/v1/palettes?limit=50' +
          ( cursor ? '&cursor=' + encodeURIComponent( cursor ) : '' ), { token: session.token, signal, maxResponseBytes: MAX_BACKUP_BYTES } );
        await this.#assertCapture( session, epoch, generation );
        exactBackupKeys( page, ['palettes', 'nextCursor'] );
        if ( !Array.isArray( page.palettes ) || page.palettes.length > 50 ) throw new AppError( 'invalidBackup' );
        for ( const record of page.palettes ) {
          const normalized = validateBackupRecord( record );
          if ( ids.has( normalized.id ) ) throw new AppError( 'invalidBackup' );
          ids.add( normalized.id );
          palettes.push( normalized.palette );
        }
        if ( palettes.length > MAX_BACKUP_PALETTES ) throw new AppError( 'invalidBackup' );
        const snapshot = validateDeviceBackup( { version: 1, createdAt: new Date().toISOString(), count: palettes.length, palettes } );
        if ( page.nextCursor === null ) {
          return await this.#mutate( () => this.#store.withSession( session, async () => {
            // withSession owns the session queue. Checks here must not enqueue cleanup.
            await this.#store.assertEpoch( epoch );
            if ( generation !== this.#generation || this.#signal?.aborted ||
              !( Date.parse( session.expiresAt ) > Date.now() ) ) throw new AppError( 'sessionChanged' );
            try { await this.#storage.writePersistent( { [BACKUP_KEY]: snapshot } ); }
            catch { throw new AppError( 'backupStorageFailed' ); }
            return { createdAt: snapshot.createdAt, count: snapshot.count };
          } ) );
        }
        if ( typeof page.nextCursor !== 'string' || !page.nextCursor || page.nextCursor.length > 256 ||
          !page.palettes.length || cursors.has( page.nextCursor ) ) throw new AppError( 'invalidBackup' );
        cursors.add( page.nextCursor ); cursor = page.nextCursor;
      }
      throw new AppError( 'invalidBackup' );
    } finally { this.#busy = false; this.#controller = null; }
  }
  open( createdAt, index, expectedVersion ) {
    return this.#mutate( async () => {
      const backup = await this.read();
      if ( !backup || backup.createdAt !== createdAt || !Number.isInteger( index ) || !backup.palettes[index] ) {
        throw new AppError( 'invalidBackup' );
      }
      return this.#palette.replacePalette( restorePaletteSnapshot( backup.palettes[index] ), expectedVersion, ( write ) => write() );
    } );
  }
}
