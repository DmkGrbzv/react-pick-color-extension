import { AppError } from '@/utils/errors.js';
import { SESSION_KEY, EPOCH_KEY, PENDING_KEY } from '@/features/auth/constants/sessionKeys.js';

export class SessionStore {
  #storage;
  #ready;
  #tail = Promise.resolve();
  constructor( storage ) {
    this.#storage = storage;
  }
  #mutate( task ) {
    const operation = this.#tail.catch( () => {} ).then( task );
    this.#tail = operation;
    return operation;
  }
  initialize() {
    this.#ready ??= Promise.all( [
      this.#storage.local.setAccessLevel( { accessLevel: 'TRUSTED_CONTEXTS' } ),
      this.#storage.session.setAccessLevel( { accessLevel: 'TRUSTED_CONTEXTS' } ),
    ] );
    return this.#ready;
  }
  async session() {
    await this.initialize();
    const value = ( await this.#storage.local.get( SESSION_KEY ) )[SESSION_KEY];
    if ( value && Date.parse( value.expiresAt ) > Date.now() ) return value;
    if ( value && !await this.clear( value.token ) ) return this.session();
    return null;
  }
  async epoch() {
    const value = await this.#storage.session.get( EPOCH_KEY );
    return value[EPOCH_KEY] ?? null;
  }
  async beginLogin() {
    await this.initialize();
    return this.#mutate( async () => {
      const epoch = crypto.randomUUID();
      await this.#storage.session.set( { [EPOCH_KEY]: epoch } );
      return epoch;
    } );
  }
  async assertEpoch( epoch ) {
    if ( await this.epoch() !== epoch ) throw new AppError( 'sessionChanged' );
  }
  saveSession( value, epoch ) {
    return this.#mutate( async () => {
      await this.assertEpoch( epoch );
      if ( !/^[\w-]{43}$/.test( value?.token ) || typeof value.user?.id !== 'string' ||
        !( Date.parse( value.expiresAt ) > Date.now() ) ) throw new AppError( 'invalidIdentity' );
      const pending = await this.pending();
      if ( pending?.ownerId && pending.ownerId !== value.user.id ) {
        await this.#storage.session.remove( PENDING_KEY );
      }
      await this.#storage.local.set( { [SESSION_KEY]: { ...value, epoch } } );
    } );
  }

  async assertSession( expected ) {
    const current = await this.session();
    if ( !current || current.token !== expected.token ) throw new AppError( 'sessionChanged' );
    return current;
  }
  withSession( expected, task ) {
    return this.#mutate( async () => {
      const current = ( await this.#storage.local.get( SESSION_KEY ) )[SESSION_KEY];
      if ( current?.token !== expected.token || !( Date.parse( current.expiresAt ) > Date.now() ) ) {
        throw new AppError( 'sessionChanged' );
      }
      // Logout/account changes cannot interleave with a local replacement write.
      return task();
    } );
  }
  clear( expectedToken ) {
    return this.#mutate( async () => {
      if ( expectedToken ) {
        const current = ( await this.#storage.local.get( SESSION_KEY ) )[SESSION_KEY];
        if ( current?.token !== expectedToken ) return false;
      }
      await this.#storage.session.set( { [EPOCH_KEY]: crypto.randomUUID() } );
      await this.#storage.local.set( { [SESSION_KEY]: null } );
      await this.#storage.session.remove( PENDING_KEY );
      return true;
    } );
  }
  async pending() {
    return ( await this.#storage.session.get( PENDING_KEY ) )[PENDING_KEY] ?? null;
  }
  renamePending( key, name ) {
    if ( typeof name !== 'string' || name.trim().length > 120 ||
      [...name].some( ( character ) => character.charCodeAt( 0 ) < 32 ) ) {
      return Promise.reject( new AppError( 'invalidPalette' ) );
    }
    return this.#mutate( async () => {
      const pending = await this.pending();
      const current = ( await this.#storage.local.get( SESSION_KEY ) )[SESSION_KEY];
      if ( !pending || pending.key !== key || pending.ownerId && pending.ownerId !== current?.user.id ) {
        throw new AppError( 'sessionChanged' );
      }
      if ( pending.submitted ) throw new AppError( 'saveConflict' );
      await this.#storage.session.set( {
        [PENDING_KEY]: { ...pending, snapshot: { ...pending.snapshot, name: name.trim() } },
      } );
    } );
  }
  setPending( value, expected ) {
    return this.#mutate( async () => {
      if ( expected ) {
        await this.assertEpoch( expected.epoch );
        const current = ( await this.#storage.local.get( SESSION_KEY ) )[SESSION_KEY];
        if ( ( current?.token ?? null ) !== expected.token ) throw new AppError( 'sessionChanged' );
      }
      await this.#storage.session.set( { [PENDING_KEY]: value } );
    } );
  }
  clearPending( key ) {
    return this.#mutate( async () => {
      if ( key && ( await this.pending() )?.key !== key ) return;
      await this.#storage.session.remove( PENDING_KEY );
    } );
  }
}
