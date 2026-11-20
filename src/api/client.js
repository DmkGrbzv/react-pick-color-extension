import { AppError } from '@/utils/errors.js';

const knownErrors = new Set( [
  'unauthorized', 'invalidPalette', 'paletteLimit', 'saveConflict', 'notFound', 'snapshotDeleted',
  'invalidAuthRequest', 'invalidIdentity', 'rateLimited', 'invalidSaveKey',
] );

async function responseJson( response, maximum ) {
  if ( !maximum ) return response.json();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while ( true ) {
      const chunk = await reader.read();
      if ( chunk.done ) break;
      size += chunk.value.byteLength;
      if ( size > maximum ) {
        await reader.cancel();
        throw new AppError( 'cloudFailed' );
      }
      text += decoder.decode( chunk.value, { stream: true } );
    }
    return JSON.parse( text + decoder.decode() );
  } finally { reader.releaseLock(); }
}

export class ApiClient {
  #url;
  constructor( url ) {
    this.#url = url;
  }
  async request( path, { token, body, key, method = 'GET', signal, maxResponseBytes } = {} ) {
    const headers = {};
    if ( token ) headers.Authorization = 'Bearer ' + token;
    if ( body !== undefined ) headers['Content-Type'] = 'application/json';
    if ( key ) headers['Idempotency-Key'] = key;
    try {
      const response = await fetch( this.#url + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify( body ),
        credentials: 'omit', redirect: 'error', cache: 'no-store',
        signal: signal ? AbortSignal.any( [signal, AbortSignal.timeout( 90_000 )] ) : AbortSignal.timeout( 90_000 ),
      } );
      if ( response.status === 204 ) return null;
      const value = await responseJson( response, maxResponseBytes );
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
