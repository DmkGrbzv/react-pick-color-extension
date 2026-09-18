// Infrastructure only: no palette rules or error handling.
export class StorageAdapter {
  #api;
  constructor( api ) {
    this.#api = api;
  }
  async get( key ) {
    const values = await this.#api.local.get( key );
    return values[key];
  }
  async set( key, value ) {
    await this.#api.local.set( { [key]: value } );
  }
  subscribe( key, onChange ) {
    const listener = ( changes, area ) => {
      if ( area === 'local' && Object.hasOwn( changes, key ) ) onChange( changes[key].newValue );
    };
    this.#api.onChanged.addListener( listener );
    return () => this.#api.onChanged.removeListener( listener );
  }
}
