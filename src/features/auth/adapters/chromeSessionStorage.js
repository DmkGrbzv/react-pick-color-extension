/** @implements {import('../services/sessionStorage.contract.js').SessionStorage} */
export class ChromeSessionStorage {
  #storage;
  #ready;
  constructor( storage ) { this.#storage = storage; }
  initialize() {
    this.#ready ??= Promise.all( [
      this.#storage.local.setAccessLevel( { accessLevel: 'TRUSTED_CONTEXTS' } ),
      this.#storage.session.setAccessLevel( { accessLevel: 'TRUSTED_CONTEXTS' } ),
    ] );
    return this.#ready;
  }
  readPersistent( key ) { return this.#storage.local.get( key ); }
  writePersistent( values ) { return this.#storage.local.set( values ); }
  removePersistent( key ) { return this.#storage.local.remove( key ); }
  readTemporary( key ) { return this.#storage.session.get( key ); }
  writeTemporary( values ) { return this.#storage.session.set( values ); }
  removeTemporary( key ) { return this.#storage.session.remove( key ); }
}
