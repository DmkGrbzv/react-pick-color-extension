import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createApp } from '../src/app.js';
import { ApiError } from '../src/http/apiError.js';
import { ApplicationError } from '../src/errors/applicationError.js';

async function fixture( context, limiter = { check: async () => {} }, readiness ) {
  const calls = [];
  const auth = {
    async authenticate( header ) {
      if ( header !== 'Bearer test' ) throw new ApiError( 401, 'unauthorized' );
      return { userId: 'A', user: { email: 'a@example.test' }, expiresAt: new Date() };
    },
    begin: async () => { throw new Error( 'secret-provider-token' ); },
  };
  const palettes = {
    async save( owner, body, key ) {
      calls.push( { owner, body, key } );
      return { created: true, palette: { id: 'palette' } };
    },
    get: async () => { throw new ApiError( 404, 'notFound' ); },
    remove: async ( owner, id ) => { calls.push( { owner, id } ); },
  };
  const app = createApp( {
    config: { origins: ['chrome-extension://allowed'], proxyHops: 0 },
    auth, palettes, limiter, readiness,
  } );
  const server = app.listen( 0, '127.0.0.1' );
  await new Promise( ( resolve ) => server.once( 'listening', resolve ) );
  context.after( () => new Promise( ( resolve ) => server.close( resolve ) ) );
  return { url: 'http://127.0.0.1:' + server.address().port, calls };
}

test( 'liveness is independent of readiness; readiness failures are sanitized and recover', async ( context ) => {
  let ready = false;
  const { url } = await fixture( context, undefined, async () => {
    if ( ready === 'error' ) throw new Error( 'mongodb://user:password@private/' );
    return ready;
  } );
  assert.deepEqual( await ( await fetch( url + '/health' ) ).json(), { status: 'ok' } );
  assert.equal( ( await fetch( url + '/ready' ) ).status, 503 );
  ready = true;
  assert.equal( ( await fetch( url + '/ready' ) ).status, 200 );
  ready = 'error';
  const failure = await fetch( url + '/ready' );
  assert.equal( failure.status, 503 );
  assert.deepEqual( await failure.json(), { status: 'notReady' } );
  assert.equal( ( await fetch( url + '/health' ) ).status, 200 );
} );

test( 'HTTP rejects unauthorized and foreign palette requests without leaking details', async ( context ) => {
  const { url } = await fixture( context );
  const unauthorized = await fetch( url + '/v1/palettes/foreign' );
  assert.equal( unauthorized.status, 401 );
  const foreign = await fetch( url + '/v1/palettes/foreign', { headers: { Authorization: 'Bearer test' } } );
  assert.equal( foreign.status, 404 );
  assert.equal( foreign.headers.get( 'cache-control' ), 'no-store' );
  const failure = await fetch( url + '/v1/auth/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  } );
  const value = await failure.json();
  assert.equal( failure.status, 500 );
  assert.equal( value.error, 'serverError' );
  assert.ok( value.requestId );
  assert.ok( !JSON.stringify( value ).includes( 'secret' ) );
} );

test( 'HTTP centrally maps application errors, preserves credential status and hides unexpected errors', async ( context ) => {
  let failure;
  const app = createApp( { config: { origins: [], proxyHops: 0 },
    auth: { begin: async () => { throw failure; } }, palettes: {}, limiter: { check: async () => {} } } );
  const server = app.listen( 0, '127.0.0.1' );
  await new Promise( ( resolve ) => server.once( 'listening', resolve ) );
  context.after( () => new Promise( ( resolve ) => server.close( resolve ) ) );
  const url = 'http://127.0.0.1:' + server.address().port + '/v1/auth/start';
  for ( const [code, status, reason] of [
    ['invalidAuthRequest', 400], ['invalidAuthRequest', 401, 'unusableCredential'],
    ['invalidIdentity', 401], ['authConfiguration', 502], ['unauthorized', 401],
    ['invalidPalette', 400], ['invalidSaveKey', 400], ['invalidCursor', 400],
    ['notFound', 404], ['paletteLimit', 409], ['saveConflict', 409], ['snapshotDeleted', 410],
    ['rateLimited', 429], ['serverError', 500], ['operationConflict', 500],
  ] ) {
    failure = new ApplicationError( code, reason );
    assert.equal( failure.status, undefined );
    const response = await fetch( url, { method: 'POST' } );
    assert.equal( response.status, status, code );
    assert.equal( ( await response.json() ).error, code === 'operationConflict' ? 'serverError' : code );
    if ( status === 429 ) assert.equal( response.headers.get( 'retry-after' ), '60' );
  }
  failure = Object.assign( new Error( 'database-password-and-driver-details' ), { code: 11000 } );
  const response = await fetch( url, { method: 'POST' } );
  assert.equal( response.status, 500 );
  const body = await response.text();
  assert.ok( body.includes( 'serverError' ) );
  assert.ok( !body.includes( 'database-password' ) );
} );

test( 'CORS preflight does not authenticate; a forged Origin is no substitute for a session', async ( context ) => {
  const { url } = await fixture( context );
  const preflight = await fetch( url + '/v1/palettes', {
    method: 'OPTIONS', headers: { Origin: 'chrome-extension://allowed' },
  } );
  assert.equal( preflight.status, 204 );
  assert.equal( preflight.headers.get( 'access-control-allow-origin' ), 'chrome-extension://allowed' );
  assert.ok( preflight.headers.get( 'access-control-allow-methods' ).includes( 'DELETE' ) );
  const forbidden = await fetch( url + '/v1/palettes', { headers: { Origin: 'https://attacker.test' } } );
  assert.equal( forbidden.status, 403 );
  const forged = await fetch( url + '/v1/palettes', { headers: { Origin: 'chrome-extension://allowed' } } );
  assert.equal( forged.status, 401 );
} );

test( 'HTTP body limits and invalid JSON are handled before mutation', async ( context ) => {
  const { url, calls } = await fixture( context );
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  const invalid = await fetch( url + '/v1/palettes', { method: 'POST', headers, body: '{' } );
  assert.equal( invalid.status, 400 );
  const oversized = await fetch( url + '/v1/palettes', { method: 'POST', headers, body: JSON.stringify( { text: 'x'.repeat( 33_000 ) } ) } );
  assert.equal( oversized.status, 413 );
  assert.equal( calls.length, 0 );
} );

test( 'compressed JSON works and malformed compressed bodies do not mutate data or stop the API', async ( context ) => {
  const { url, calls } = await fixture( context );
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' };
  const body = { name: 'Compressed palette', items: [{ type: 'color', hex: '#AABBCC' }] };
  const compressed = gzipSync( JSON.stringify( body ) );
  const valid = await fetch( url + '/v1/palettes', {
    method: 'POST', headers, body: compressed, signal: AbortSignal.timeout( 5000 ),
  } );
  assert.equal( valid.status, 201 );
  assert.deepEqual( calls[0].body, body );
  const invalid = await fetch( url + '/v1/palettes', {
    method: 'POST', headers, body: Buffer.concat( [compressed, Buffer.from( [255, 255, 255] )] ),
    signal: AbortSignal.timeout( 5000 ),
  } );
  assert.ok( invalid.status >= 400 );
  assert.equal( calls.length, 1 );
  assert.equal( ( await fetch( url + '/health' ) ).status, 200 );
} );

test( 'authenticated rate limits include both IP and user and return retry guidance', async ( context ) => {
  const checks = [];
  const limiter = {
    async check( scope, identity ) {
      checks.push( { scope, identity } );
      if ( scope === 'api:user' ) throw new ApiError( 429, 'rateLimited' );
    },
  };
  const { url } = await fixture( context, limiter );
  const response = await fetch( url + '/v1/me', { headers: { Authorization: 'Bearer test' } } );
  assert.equal( response.status, 429 );
  assert.equal( response.headers.get( 'retry-after' ), '60' );
  assert.equal( checks[0].scope, 'api' );
  assert.deepEqual( checks[1], { scope: 'api:user', identity: 'A' } );
} );

test( 'DELETE requires a session and derives ownership from it', async ( context ) => {
  const { url, calls } = await fixture( context );
  const unauthorized = await fetch( url + '/v1/palettes/own', { method: 'DELETE' } );
  assert.equal( unauthorized.status, 401 );
  assert.equal( calls.length, 0 );
  const removed = await fetch( url + '/v1/palettes/own?ownerId=B', {
    method: 'DELETE', headers: { Authorization: 'Bearer test' },
  } );
  assert.equal( removed.status, 204 );
  assert.deepEqual( calls, [{ owner: 'A', id: 'own' }] );
} );
