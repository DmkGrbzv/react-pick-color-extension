import * as oidc from 'openid-client';
import { ApiError } from '../http/apiError.js';

// Provider adapter: AuthService depends only on authorizeUrl() and verify().
// Google is selected by deployment configuration, not by the session service.
export class OidcProvider {
  #client;
  #issuer;
  #callback;
  constructor( { client, issuer, callback } ) {
    this.#client = client;
    this.#issuer = issuer;
    this.#callback = callback;
  }

  authorizeUrl( transaction ) {
    return oidc.buildAuthorizationUrl( this.#client, {
      redirect_uri: this.#callback,
      response_type: 'code', scope: 'openid email',
      state: transaction.state, nonce: transaction.nonce,
      code_challenge: transaction.providerChallenge, code_challenge_method: 'S256',
    } ).href;
  }

  async verify( query, transaction ) {
    try {
      const callback = new URL( this.#callback );
      for ( const [key, value] of Object.entries( query ) ) {
        if ( typeof value !== 'string' ) throw new ApiError( 400, 'invalidAuthRequest' );
        callback.searchParams.set( key, value );
      }
      const tokens = await oidc.authorizationCodeGrant( this.#client, callback, {
        pkceCodeVerifier: transaction.providerVerifier,
        expectedState: transaction.state, expectedNonce: transaction.nonce,
        idTokenExpected: true,
      } );
      const claims = tokens.claims();
      if ( !claims?.sub ) throw new ApiError( 401, 'invalidIdentity' );
      return {
        provider: this.#issuer, sub: claims.sub,
        email: claims.email_verified === true ? claims.email : undefined,
      };
    } catch ( error ) {
      if ( error.error === 'invalid_client' || error.cause?.error === 'invalid_client' ) {
        throw new ApiError( 502, 'authConfiguration' );
      }
      throw new ApiError( 401, 'invalidIdentity' );
    }
  }
}

export async function createIdentityProvider( config ) {
  const client = await oidc.discovery( new URL( config.issuer ), config.oidcClientId, config.oidcClientSecret );
  // Code-flow ID tokens must have their signatures checked as well as their claims.
  oidc.enableNonRepudiationChecks( client );
  return new OidcProvider( { client, issuer: config.issuer, callback: config.apiOrigin + '/v1/auth/callback' } );
}
