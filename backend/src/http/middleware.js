import { randomUUID } from 'node:crypto';
import { ApiError } from './apiError.js';

export function requestContext( request, response, next ) {
  request.requestId = randomUUID();
  response.set( 'X-Request-Id', request.requestId );
  response.set( 'Cache-Control', 'no-store' );
  next();
}

export function corsPolicy( config ) {
  const origins = new Set( config.origins );
  return ( request, response, next ) => {
    const origin = request.get( 'Origin' );
    response.vary( 'Origin' );
    if ( origin && !origins.has( origin ) ) throw new ApiError( 403, 'originForbidden' );
    if ( origin ) response.set( 'Access-Control-Allow-Origin', origin );
    if ( request.method !== 'OPTIONS' ) return next();
    response.set( 'Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS' );
    response.set( 'Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key' );
    response.sendStatus( 204 );
  };
}

export function authenticate( auth ) {
  return async ( request, response, next ) => {
    request.session = await auth.authenticate( request.get( 'Authorization' ) );
    next();
  };
}

export function rateLimit( limiter, scope, maximum ) {
  return async ( request, response, next ) => {
    await limiter.check( scope, request.ip, maximum );
    if ( request.session ) await limiter.check( scope + ':user', request.session.userId, maximum );
    next();
  };
}

// Never return provider errors, SQL/DB messages, tokens or stack traces.
export function errorResponse( error, request, response, next ) {
  if ( response.headersSent ) return next( error );
  const status = error instanceof ApiError ? error.status :
    error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  const code = error instanceof ApiError ? error.code : status === 413 ? 'bodyTooLarge' :
    status === 400 ? 'invalidJson' : 'serverError';
  if ( status === 429 ) response.set( 'Retry-After', '60' );
  response.status( status ).json( { error: code, requestId: request.requestId } );
}
