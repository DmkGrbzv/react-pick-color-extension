import { AppError } from '@/errors.js';
import { createCloudSnapshot, restoreCloudSnapshot, snapshotSignature, isSavedPalette } from './snapshot.js';

export class CloudService {
  #http;
  #store;
  #login;
  #palette;
  #saving = false;
  #signingIn = false;
  #preparing = false;
  constructor( { http, store, login, palette } ) {
    this.#http = http;
    this.#store = store;
    this.#login = login;
    this.#palette = palette;
  }

  async state() {
    const session = await this.#store.session();
    const pending = await this.#store.pending();
    return {
      configured: true,
      sessionId: session?.epoch ?? null,
      user: session ? { ...session.user, expiresAt: session.expiresAt } : null,
      pending: pending && ( !pending.ownerId || pending.ownerId === session?.user.id )
        ? { key: pending.key, snapshot: pending.snapshot, submitted: Boolean( pending.submitted ) } : null,
    };
  }

  async signIn() {
    if ( this.#signingIn ) throw new AppError( 'cloudBusy' );
    this.#signingIn = true;
    try {
      const epoch = await this.#store.beginLogin();
      const value = await this.#login.signIn();
      await this.#store.saveSession( value, epoch );
      return this.state();
    } finally {
      this.#signingIn = false;
    }
  }

  async logout() {
    const session = await this.#store.session();
    await this.#store.clear();
    if ( session ) {
      try {
        await this.#http.request( '/v1/auth/logout', { method: 'POST', token: session.token } );
      } catch {
        throw new AppError( 'logoutUnconfirmed' );
      }
    }
    return this.state();
  }

  async #session() {
    const session = await this.#store.session();
    if ( !session ) throw new AppError( 'unauthorized' );
    return session;
  }

  async #request( path, options, session ) {
    try {
      const value = await this.#http.request( path, { ...options, token: session.token } );
      await this.#store.assertSession( session );
      return value;
    } catch ( error ) {
      const current = await this.#store.session();
      if ( error.code === 'unauthorized' && current?.token === session.token ) await this.#store.clear( session.token );
      throw error;
    }
  }

  async prepare() {
    if ( this.#saving || this.#preparing ) throw new AppError( 'cloudBusy' );
    this.#preparing = true;
    try {
      const existing = await this.#store.pending();
      if ( existing ) return this.state();
      const session = await this.#store.session();
      const epoch = await this.#store.epoch();
      const working = await this.#palette.getPalette();
      if ( isSavedPalette( working, session?.user.id ) ) throw new AppError( 'paletteUnchanged' );
      const snapshot = createCloudSnapshot( working );
      await this.#store.setPending( {
        key: crypto.randomUUID(), snapshot, signature: snapshotSignature( working ), ownerId: session?.user.id ?? null,
      }, { token: session?.token ?? null, epoch } );
      return this.state();
    } finally {
      this.#preparing = false;
    }
  }

  async cancelSave() {
    if ( this.#saving || this.#preparing ) throw new AppError( 'cloudBusy' );
    await this.#store.clearPending();
    return this.state();
  }

  async renamePending( key, name ) {
    if ( this.#saving || this.#preparing ) throw new AppError( 'cloudBusy' );
    await this.#store.renamePending( key, name );
    return this.state();
  }

  async save( key ) {
    if ( this.#saving ) throw new AppError( 'cloudBusy' );
    this.#saving = true;
    try {
      const session = await this.#session();
      const pending = await this.#store.pending();
      if ( !pending || pending.key !== key || pending.ownerId && pending.ownerId !== session.user.id ) {
        throw new AppError( 'sessionChanged' );
      }
      await this.#store.setPending( { ...pending, ownerId: session.user.id, submitted: true }, {
        token: session.token, epoch: await this.#store.epoch(),
      } );
      const palette = await this.#request( '/v1/palettes', {
        method: 'POST', key: pending.key, body: pending.snapshot,
      }, session );
      if ( pending.signature ) await this.#palette.markCloudSource( {
        id: palette.id, ownerId: session.user.id, signature: pending.signature,
      }, ( write ) => this.#store.withSession( session, write ) );
      await this.#store.clearPending( pending.key );
      return palette;
    } finally {
      this.#saving = false;
    }
  }

  async list( cursor ) {
    const session = await this.#session();
    if ( cursor !== undefined && ( typeof cursor !== 'string' || cursor.length > 256 ) ) {
      throw new AppError( 'invalidPalette' );
    }
    const suffix = '?limit=4' + ( cursor ? '&cursor=' + encodeURIComponent( cursor ) : '' );
    return this.#request( '/v1/palettes' + suffix, {}, session );
  }

  async get( id ) {
    const session = await this.#session();
    return this.#request( '/v1/palettes/' + this.#id( id ), {}, session );
  }

  #id( value ) {
    if ( typeof value !== 'string' || !/^[\da-f-]{36}$/i.test( value ) ) throw new AppError( 'invalidPalette' );
    return value;
  }

  async open( id, expectedVersion ) {
    const session = await this.#session();
    const snapshot = await this.#request( '/v1/palettes/' + this.#id( id ), {}, session );
    const replacement = restoreCloudSnapshot( snapshot );
    replacement.cloudSource = { id, ownerId: session.user.id, signature: snapshotSignature( replacement ) };
    // Session guard is checked inside the same local mutation queue as the replacement.
    return this.#palette.replacePalette( replacement, expectedVersion,
      ( write ) => this.#store.withSession( session, write ) );
  }

  async rename( id, name ) {
    const session = await this.#session();
    return this.#request( '/v1/palettes/' + this.#id( id ), { method: 'PATCH', body: { name } }, session );
  }

  async remove( id ) {
    const session = await this.#session();
    await this.#request( '/v1/palettes/' + this.#id( id ), { method: 'DELETE' }, session );
    await this.#palette.clearCloudSource( id, session.user.id );
  }
}
