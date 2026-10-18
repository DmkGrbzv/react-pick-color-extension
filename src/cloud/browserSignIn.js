import { AppError } from '@/errors.js';

function randomSecret() {
  const bytes = crypto.getRandomValues( new Uint8Array( 32 ) );
  return btoa( String.fromCharCode( ...bytes ) ).replaceAll( '+', '-' ).replaceAll( '/', '_' ).replaceAll( '=', '' );
}

async function challengeFor( verifier ) {
  const hash = await crypto.subtle.digest( 'SHA-256', new TextEncoder().encode( verifier ) );
  return btoa( String.fromCharCode( ...new Uint8Array( hash ) ) )
    .replaceAll( '+', '-' ).replaceAll( '/', '_' ).replaceAll( '=', '' );
}

export class BrowserSignIn {
  #api;
  #http;
  constructor( { api, http } ) {
    this.#api = api;
    this.#http = http;
  }
  async signIn() {
    const verifier = randomSecret();
    const clientState = randomSecret();
    const { url } = await this.#http.request( '/v1/auth/start', {
      method: 'POST', body: {
        redirectUri: this.#api.identity.getRedirectURL( 'oauth' ), challenge: await challengeFor( verifier ), clientState,
      },
    } );
    const target = new URL( url );
    if ( target.protocol !== 'https:' || target.username || target.password ) throw new AppError( 'invalidAuthRequest' );
    let result;
    try {
      result = await this.#api.identity.launchWebAuthFlow( { url, interactive: true } );
    } catch ( error ) {
      const cancelled = error.message === 'The user did not approve access.';
      throw new AppError( cancelled ? 'authCancelled' : 'authFlowFailed' );
    }
    const returned = new URL( result );
    const expected = new URL( this.#api.identity.getRedirectURL( 'oauth' ) );
    if ( returned.origin !== expected.origin || returned.pathname !== expected.pathname ||
      returned.searchParams.get( 'state' ) !== clientState ) throw new AppError( 'invalidAuthRequest' );
    const failure = returned.searchParams.get( 'error' );
    if ( failure ) {
      const known = ['authCancelled', 'authConfiguration', 'invalidIdentity'];
      throw new AppError( known.includes( failure ) ? failure : 'invalidAuthRequest' );
    }
    return this.#http.request( '/v1/auth/exchange', {
      method: 'POST', body: { code: returned.searchParams.get( 'code' ), verifier },
    } );
  }
}
