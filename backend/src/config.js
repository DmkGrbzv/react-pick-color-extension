function required( env, key ) {
  if ( !env[key]?.trim() ) throw new Error( 'Missing configuration: ' + key );
  return env[key].trim();
}

function integer( value, name, maximum ) {
  const number = Number( value );
  if ( !Number.isInteger( number ) || number < 1 || number > maximum ) {
    throw new Error( 'Invalid configuration: ' + name );
  }
  return number;
}

export function readConfig( env ) {
  const api = new URL( required( env, 'PUBLIC_API_URL' ) );
  const development = env.NODE_ENV === 'development';
  const mongoUri = required( env, 'MONGODB_URI' );
  const encryptedMongo = mongoUri.startsWith( 'mongodb+srv://' ) || /[?&](tls|ssl)=true(&|$)/i.test( mongoUri );
  if ( !development && ( !encryptedMongo || /[?&](tls|ssl)=false(&|$)/i.test( mongoUri ) ) ) {
    throw new Error( 'Production MongoDB requires TLS' );
  }
  const local = ['localhost', '127.0.0.1'].includes( api.hostname );
  if ( api.protocol !== 'https:' && !( development && local && api.protocol === 'http:' ) ) {
    throw new Error( 'PUBLIC_API_URL requires HTTPS outside local development' );
  }
  if ( api.username || api.password || api.search || api.hash || api.pathname !== '/' ) {
    throw new Error( 'PUBLIC_API_URL must be an origin' );
  }
  const redirectUris = required( env, 'AUTH_REDIRECT_URIS' ).split( ',' ).map( ( value ) => value.trim() );
  for ( const value of redirectUris ) {
    const url = new URL( value );
    if ( url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ) {
      throw new Error( 'AUTH_REDIRECT_URIS requires exact HTTPS callback URLs' );
    }
  }
  const origins = required( env, 'EXTENSION_ORIGINS' ).split( ',' ).map( ( value ) => value.trim() );
  for ( const value of origins ) {
    const url = new URL( value );
    if ( !['chrome-extension:', 'moz-extension:'].includes( url.protocol ) ||
      !url.hostname || value !== url.protocol + '//' + url.hostname ) {
      throw new Error( 'Invalid EXTENSION_ORIGINS' );
    }
  }
  const proxyHops = Number( env.TRUST_PROXY_HOPS ?? 0 );
  if ( !Number.isInteger( proxyHops ) || proxyHops < 0 || proxyHops > 5 ) {
    throw new Error( 'Invalid TRUST_PROXY_HOPS' );
  }
  const issuer = new URL( required( env, 'OIDC_ISSUER' ) );
  if ( issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash ) {
    throw new Error( 'OIDC_ISSUER requires a trusted HTTPS issuer' );
  }
  return {
    port: integer( env.PORT ?? 3001, 'PORT', 65535 ),
    apiOrigin: api.origin,
    redirectUris,
    origins,
    proxyHops,
    mongoUri,
    database: required( env, 'MONGODB_DATABASE' ),
    issuer: required( env, 'OIDC_ISSUER' ),
    oidcClientId: required( env, 'OIDC_CLIENT_ID' ),
    oidcClientSecret: required( env, 'OIDC_CLIENT_SECRET' ),
    sessionSeconds: integer( required( env, 'SESSION_TTL_SECONDS' ), 'SESSION_TTL_SECONDS', 2592000 ),
    maxItems: integer( env.MAX_PALETTE_ITEMS ?? 256, 'MAX_PALETTE_ITEMS', 256 ),
    maxPalettes: integer( env.MAX_USER_PALETTES ?? 100, 'MAX_USER_PALETTES', 1000 ),
  };
}
