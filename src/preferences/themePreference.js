import { StorageAdapter } from '@/storage.js';
import { requireExtension } from '@/runtime/sendRequest.js';
import { THEMES, THEME_KEY, normalizeTheme } from '@/constants/themes.js';

export class ThemePreference {
  #storage;

  constructor( api ) {
    if ( api === undefined ) {
      requireExtension();
      api = chrome.storage;
    }
    this.#storage = new StorageAdapter( api );
  }

  async read() {
    return normalizeTheme( await this.#storage.get( THEME_KEY ) );
  }

  async save( theme ) {
    if ( !Object.values( THEMES ).includes( theme ) ) throw new Error( 'Unsupported theme' );
    await this.#storage.set( THEME_KEY, theme );
  }

  subscribe( onChange ) {
    return this.#storage.subscribe( THEME_KEY, ( value ) => onChange( normalizeTheme( value ) ) );
  }
}
