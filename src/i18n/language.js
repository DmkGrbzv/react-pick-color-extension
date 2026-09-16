export const LANGUAGE_KEY = 'language';
export const SUPPORTED_LANGUAGES = ['uk', 'en'];

export function resolveLanguage( language ) {
  const base = typeof language === 'string' ? language.toLowerCase().split( /[-_]/ )[0] : '';
  return SUPPORTED_LANGUAGES.includes( base ) ? base : 'uk';
}

export function createLanguagePreference( api, defaultLanguage, onLanguage ) {
  let revision = 0;
  let listener;
  const apply = ( value ) => onLanguage( resolveLanguage( value ?? defaultLanguage ) );

  return {
    async start() {
      if ( !api ) return;
      listener = ( changes, area ) => {
        if ( area !== 'local' || !changes[LANGUAGE_KEY] ) return;
        revision++;
        apply( changes[LANGUAGE_KEY].newValue );
      };
      api.onChanged.addListener( listener );
      const beforeRead = revision;
      const stored = await api.local.get( LANGUAGE_KEY );
      if ( revision === beforeRead ) apply( stored[LANGUAGE_KEY] );
    },
    async set( language ) {
      if ( !SUPPORTED_LANGUAGES.includes( language ) ) throw new Error( 'Unsupported language' );
      if ( !api ) {
        apply( language );
        return;
      }
      const beforeWrite = revision;
      await api.local.set( { [LANGUAGE_KEY]: language } );
      // Some contexts receive onChanged before the write promise settles.
      if ( revision === beforeWrite ) apply( language );
    },
    stop() {
      if ( listener ) api.onChanged.removeListener( listener );
    },
  };
}
