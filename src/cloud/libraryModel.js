import * as cloud from '@/api/cloudClient.js';

const initial = {
  user: null, pending: null, palettes: [], nextCursor: null,
  busy: '', loading: false, error: null, libraryError: null, stateError: null, notice: '', detail: null,
};

// View state only. Credentials, persistence and account checks remain in the worker.
export class CloudLibraryModel {
  #state = initial;
  #listeners = new Set();
  #active = false;
  #generation = 0;
  #refreshId = 0;
  #listRevision = 0;
  #sessionId = null;
  #operation = false;
  #timer;
  #api;
  #loadLibrary;
  constructor( api = cloud, { loadLibrary = true } = {} ) {
    this.#api = api;
    this.#loadLibrary = loadLibrary;
  }
  getSnapshot = () => this.#state;
  subscribe = ( listener ) => {
    this.#listeners.add( listener );
    return () => this.#listeners.delete( listener );
  };
  #publish( changes ) {
    if ( !this.#active ) return;
    this.#state = { ...this.#state, ...changes };
    for ( const listener of this.#listeners ) listener();
  }
  start() {
    this.#active = true;
    void this.refresh();
  }
  setLibraryActive( active ) {
    if ( this.#loadLibrary === active ) return;
    this.#loadLibrary = active;
    if ( active && this.#active && this.#state.user ) void this.loadMore( true );
  }
  stop() {
    this.#active = false;
    this.#generation++;
    this.#refreshId++;
    clearTimeout( this.#timer );
  }
  sessionChanged() {
    this.#generation++;
    this.#sessionId = null;
    this.#publish( { ...initial, busy: this.#state.busy } );
    void this.refresh();
  }
  async refresh( reload = false ) {
    const request = ++this.#refreshId;
    try {
      const value = await this.#api.getCloudState();
      if ( !this.#active || request !== this.#refreshId ) return;
      const changed = value.sessionId !== this.#sessionId;
      if ( changed ) {
        this.#generation++;
        this.#sessionId = value.sessionId;
        this.#listRevision++;
        this.#publish( { palettes: [], nextCursor: null, detail: null, loading: false, libraryError: null } );
      }
      this.#publish( { user: value.user, pending: value.pending, stateError: null } );
      clearTimeout( this.#timer );
      if ( value.user ) this.#timer = setTimeout( () => this.sessionChanged(),
        Math.min( 2_147_483_647, Math.max( 0, Date.parse( value.user.expiresAt ) - Date.now() ) ) );
      if ( this.#loadLibrary && value.user && ( changed || reload ) ) await this.loadMore( true );
    } catch ( error ) {
      if ( request === this.#refreshId ) this.#publish( { stateError: error } );
    }
  }
  async loadMore( reset = false ) {
    if ( this.#state.loading || !this.#state.user ) return;
    const generation = this.#generation;
    const cursor = reset ? undefined : this.#state.nextCursor;
    const revision = ++this.#listRevision;
    this.#publish( { loading: true, libraryError: null } );
    try {
      const page = await this.#api.listCloudPalettes( cursor );
      if ( generation !== this.#generation || revision !== this.#listRevision ) return;
      const values = reset ? [] : this.#state.palettes;
      const palettes = [...new Map( [...values, ...page.palettes].map( ( item ) => [item.id, item] ) ).values()];
      this.#publish( { palettes, nextCursor: page.nextCursor } );
    } catch ( error ) {
      if ( generation === this.#generation && revision === this.#listRevision ) this.#publish( { libraryError: error } );
    } finally {
      if ( generation === this.#generation && revision === this.#listRevision ) this.#publish( { loading: false } );
    }
  }
  async #perform( task, busy ) {
    if ( this.#operation ) return;
    this.#operation = true;
    this.#publish( { busy, error: null, notice: '' } );
    const generation = this.#generation;
    try {
      return await task( generation );
    } catch ( error ) {
      if ( generation === this.#generation || busy === 'signingOut' && !this.#state.user ) this.#publish( { error } );
    } finally {
      this.#operation = false;
      this.#publish( { busy: '' } );
      await this.refresh();
    }
  }
  signIn() {
    return this.#perform( () => this.#api.signIn(), 'signingIn' );
  }
  logout() {
    this.#generation++;
    this.#refreshId++;
    this.#sessionId = null;
    this.#publish( initial );
    return this.#perform( () => this.#api.signOut(), 'signingOut' );
  }
  prepare() {
    return this.#perform( () => this.#api.prepareCloudSave(), 'preparing' );
  }
  cancel() {
    return this.#perform( () => this.#api.cancelCloudSave(), 'preparing' );
  }
  save( name ) {
    const key = this.#state.pending?.key;
    const submitted = this.#state.pending?.submitted;
    return this.#perform( async ( generation ) => {
      if ( !submitted && name !== undefined ) await this.#api.nameCloudSave( key, name );
      if ( generation !== this.#generation ) return;
      const palette = await this.#api.saveCloudPalette( key );
      if ( generation !== this.#generation ) return;
      const palettes = [palette, ...this.#state.palettes.filter( ( item ) => item.id !== palette.id )];
      this.#publish( { palettes, notice: 'saved' } );
    }, 'saving' );
  }
  details( id ) {
    return this.#perform( async ( generation ) => {
      const detail = await this.#api.getCloudPalette( id );
      if ( generation === this.#generation ) this.#publish( { detail } );
    }, 'loadingDetails' );
  }
  closeDetails() {
    this.#publish( { detail: null } );
  }
  open( id, expectedVersion ) {
    return this.#perform( async ( generation ) => {
      await this.#api.openCloudPalette( id, expectedVersion );
      if ( generation !== this.#generation ) return false;
      this.#publish( { detail: null, notice: 'opened' } );
      return true;
    }, 'opening' );
  }
  rename( id, name ) {
    return this.#perform( async ( generation ) => {
      const value = await this.#api.renameCloudPalette( id, name );
      if ( generation !== this.#generation ) return;
      this.#publish( {
        detail: value,
        palettes: this.#state.palettes.map( ( item ) => item.id === id ? value : item ),
      } );
    }, 'renaming' );
  }

  remove( id ) {
    return this.#perform( async ( generation ) => {
      await this.#api.deleteCloudPalette( id );
      if ( generation !== this.#generation ) return;
      this.#listRevision++;
      this.#publish( {
        palettes: this.#state.palettes.filter( ( item ) => item.id !== id ),
        detail: this.#state.detail?.id === id ? null : this.#state.detail,
        loading: false, notice: 'deleted',
      } );
    }, 'deleting' );
  }
}
