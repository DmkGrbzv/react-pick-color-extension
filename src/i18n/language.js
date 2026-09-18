export const LANGUAGE_KEY = 'language';
export const SUPPORTED_LANGUAGES = ['uk', 'en'];

export function resolveLanguage( language ) {
  const base = typeof language === 'string' ? language.toLowerCase().split( /[-_]/ )[0] : '';
  return SUPPORTED_LANGUAGES.includes( base ) ? base : 'uk';
}

export class LanguagePreference {
  #api;
  #defaultLanguage;
  #onLanguage;
  #revision = 0;
  #listener;
  constructor( api, defaultLanguage, onLanguage ) {
    this.#api = api;
    this.#defaultLanguage = defaultLanguage;
    this.#onLanguage = onLanguage;
  }
  #apply( value ) {
    this.#onLanguage( resolveLanguage( value ?? this.#defaultLanguage ) );
  }
  async start() {
    if ( !this.#api ) return;
    this.#listener = ( changes, area ) => {
      if ( area !== 'local' || !changes[LANGUAGE_KEY] ) return;
      this.#revision++;
      this.#apply( changes[LANGUAGE_KEY].newValue );
    };
    this.#api.onChanged.addListener( this.#listener );
    const beforeRead = this.#revision;
    const stored = await this.#api.local.get( LANGUAGE_KEY );
    if ( this.#revision === beforeRead ) this.#apply( stored[LANGUAGE_KEY] );
  }
  async set( language ) {
    if ( !SUPPORTED_LANGUAGES.includes( language ) ) throw new Error( 'Unsupported language' );
    if ( !this.#api ) {
      this.#apply( language );
      return;
    }
    const beforeWrite = this.#revision;
    await this.#api.local.set( { [LANGUAGE_KEY]: language } );
    // onChanged may arrive before the write promise settles.
    if ( this.#revision === beforeWrite ) this.#apply( language );
  }
  stop() {
    if ( this.#listener ) this.#api.onChanged.removeListener( this.#listener );
  }
}
