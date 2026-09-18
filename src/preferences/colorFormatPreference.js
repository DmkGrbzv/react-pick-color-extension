import { StorageAdapter } from '@/storage.js';
import { requireExtension } from '@/runtime/sendRequest.js';
import { COLOR_FORMATS } from '@/utils/colorConversion.js';
const KEY = 'colorFormat';
const normalize = ( value ) => ( COLOR_FORMATS.includes( value ) ? value : 'hex' );
export class ColorFormatPreference {
  #storage;
  constructor( api ) {
    if ( api === undefined ) {
      requireExtension();
      api = chrome.storage;
    }
    this.#storage = new StorageAdapter( api );
  }
  async read() {
    return normalize( await this.#storage.get( KEY ) );
  }
  async save( value ) {
    if ( !COLOR_FORMATS.includes( value ) ) throw new Error( 'Invalid color format' );
    await this.#storage.set( KEY, value );
  }
  subscribe( onChange ) {
    return this.#storage.subscribe( KEY, ( value ) => onChange( normalize( value ) ) );
  }
}
