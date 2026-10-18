import { AppError } from '@/errors.js';

const knownErrors = new Set( [
  'unauthorized', 'invalidPalette', 'paletteLimit', 'saveConflict', 'notFound', 'snapshotDeleted',
  'invalidAuthRequest', 'invalidIdentity', 'rateLimited', 'invalidSaveKey',
] );

export class CloudHttpClient {
  #url;
  constructor( url ) {
    this.#url = url;
  }
  async request( path, { token, body, key, method = 'GET' } = {} ) {
    const headers = {};
    if ( token ) headers.Authorization = 'Bearer ' + token;
    if ( body !== undefined ) headers['Content-Type'] = 'application/json';
    if ( key ) headers['Idempotency-Key'] = key;
    try {
      const response = await fetch( this.#url + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify( body ),
        credentials: 'omit', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout( 90_000 ),
      } );
      if ( response.status === 204 ) return null;
      const value = await response.json();
      if ( !response.ok ) {
        throw new AppError( knownErrors.has( value.error ) ? value.error : 'cloudFailed' );
      }
      return value;
    } catch ( error ) {
      if ( error instanceof AppError ) throw error;
      throw new AppError( 'cloudFailed' );
    }
  }
}
