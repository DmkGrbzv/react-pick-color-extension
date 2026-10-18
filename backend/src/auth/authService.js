import { ApiError } from '../http/apiError.js';
import { digest, matches, secret } from './crypto.js';

function validChallenge( value ) {
  return typeof value === 'string' && /^[\w-]{43}$/.test( value );
}

export class AuthService {
  #repository;
  #provider;
  #config;
  constructor( { repository, provider, config } ) {
    this.#repository = repository;
    this.#provider = provider;
    this.#config = config;
  }

  async begin( input ) {
    if ( !input || Object.keys( input ).some( ( key ) => !['redirectUri', 'challenge', 'clientState'].includes( key ) ) ||
      !this.#config.redirectUris.includes( input.redirectUri ) ||
      !validChallenge( input.challenge ) || !validChallenge( input.clientState ) ) {
      throw new ApiError( 400, 'invalidAuthRequest' );
    }
    const providerVerifier = secret();
    const transaction = {
      state: secret(), nonce: secret(), providerVerifier,
      providerChallenge: digest( providerVerifier ),
      challenge: input.challenge, clientState: input.clientState,
      redirectUri: input.redirectUri,
      expiresAt: new Date( Date.now() + 5 * 60_000 ),
    };
    await this.#repository.createTransaction( transaction );
    return { url: this.#provider.authorizeUrl( transaction ) };
  }

  async callback( query ) {
    if ( !validChallenge( query.state ) ) throw new ApiError( 400, 'invalidAuthRequest' );
    const transaction = await this.#repository.takeTransaction( query.state );
    if ( !transaction ) throw new ApiError( 401, 'invalidAuthRequest' );
    const redirect = new URL( transaction.redirectUri );
    redirect.searchParams.set( 'state', transaction.clientState );
    if ( query.error ) {
      redirect.searchParams.set( 'error', 'authCancelled' );
      return redirect.href;
    }
    if ( typeof query.code !== 'string' || query.code.length > 4096 ) {
      throw new ApiError( 400, 'invalidAuthRequest' );
    }
    try {
      const code = await this.#completeLogin( query, transaction );
      redirect.searchParams.set( 'code', code );
    } catch ( error ) {
      if ( !['invalidIdentity', 'authConfiguration'].includes( error.code ) ) throw error;
      redirect.searchParams.set( 'error', error.code );
    }
    return redirect.href;
  }

  async #completeLogin( query, transaction ) {
    const identity = await this.#provider.verify( query, transaction );
    const user = await this.#repository.findUser( identity );
    const code = secret();
    await this.#repository.createExchange( {
      codeHash: digest( code ), challenge: transaction.challenge,
      userId: user._id, email: user.email,
      expiresAt: new Date( Date.now() + 60_000 ),
    } );
    return code;
  }

  async exchange( input ) {
    if ( !input || Object.keys( input ).some( ( key ) => !['code', 'verifier'].includes( key ) ) ||
      !validChallenge( input.code ) || typeof input.verifier !== 'string' ||
      !/^[\w-]{43,128}$/.test( input.verifier ) ) throw new ApiError( 400, 'invalidAuthRequest' );
    const exchange = await this.#repository.takeExchange( digest( input.code ), digest( input.verifier ) );
    if ( !exchange ) throw new ApiError( 401, 'invalidAuthRequest' );
    const token = secret();
    const expiresAt = new Date( Date.now() + this.#config.sessionSeconds * 1000 );
    await this.#repository.createSession( { tokenHash: digest( token ), userId: exchange.userId, expiresAt } );
    return { token, expiresAt, user: { id: exchange.userId, email: exchange.email } };
  }

  async authenticate( authorization ) {
    const token = typeof authorization === 'string' ? authorization.match( /^Bearer ([\w-]{43})$/ )?.[1] : null;
    if ( !token ) throw new ApiError( 401, 'unauthorized' );
    const session = await this.#repository.findSession( digest( token ) );
    if ( !session || !matches( session.tokenHash, digest( token ) ) ) throw new ApiError( 401, 'unauthorized' );
    return session;
  }

  logout( session ) {
    return this.#repository.revokeSession( session.tokenHash );
  }
}
