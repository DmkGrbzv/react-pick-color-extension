import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/authService.js';
import { AuthMemoryRepository } from './helpers/authMemory.js';
import { digest, secret } from '../src/auth/crypto.js';
import { ApiError } from '../src/http/apiError.js';

const redirectUri = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/oauth';

function setup( provider = {
  authorizeUrl: ( transaction ) => 'https://identity.test/?state=' + transaction.state,
  verify: async () => ( { provider: 'https://identity.test', sub: 'user-1', email: 'first@example.test' } ),
} ) {
  const repository = new AuthMemoryRepository();
  const service = new AuthService( {
    repository, provider, config: { redirectUris: [redirectUri], sessionSeconds: 86400 },
  } );
  return { service, repository };
}

async function login( service ) {
  const verifier = secret();
  const clientState = secret();
  const started = await service.begin( { redirectUri, challenge: digest( verifier ), clientState } );
  const state = new URL( started.url ).searchParams.get( 'state' );
  const result = new URL( await service.callback( { state, code: 'provider-code' } ) );
  assert.equal( result.searchParams.get( 'state' ), clientState );
  return { state, exchange: { verifier, code: result.searchParams.get( 'code' ) } };
}

test( 'provider is injected; login creates an application session without touching palettes', async () => {
  const { service, repository } = setup();
  const input = await login( service );
  const before = Date.now();
  const value = await service.exchange( input.exchange );
  assert.equal( value.user.id, 'https://identity.test:user-1' );
  assert.ok( value.expiresAt.getTime() >= before + 86400_000 );
  assert.equal( repository.sessions.size, 1 );
  assert.equal( [...repository.sessions.values()][0].token, undefined );
  assert.equal( ( await service.authenticate( 'Bearer ' + value.token ) ).userId, value.user.id );
} );

test( 'unknown redirect, invalid challenge and unknown state are rejected', async () => {
  const { service } = setup();
  await assert.rejects( service.begin( { redirectUri: 'https://attacker.test', challenge: secret(), clientState: secret() } ), { code: 'invalidAuthRequest' } );
  await assert.rejects( service.begin( { redirectUri, challenge: 'invalid', clientState: secret() } ), { code: 'invalidAuthRequest' } );
  await assert.rejects( service.callback( { state: secret(), code: 'code' } ), { code: 'invalidAuthRequest' } );
} );

test( 'callback and exchange are single-use; wrong verifier cannot redeem the code', async () => {
  const { service } = setup();
  const input = await login( service );
  await assert.rejects( service.callback( { state: input.state, code: 'code' } ), { code: 'invalidAuthRequest' } );
  await assert.rejects( service.exchange( { code: input.exchange.code, verifier: secret() } ), { code: 'invalidAuthRequest' } );
  await assert.rejects( service.exchange( { ...input.exchange, ownerId: 'attacker' } ), { code: 'invalidAuthRequest' } );
  await service.exchange( input.exchange );
  await assert.rejects( service.exchange( input.exchange ), { code: 'invalidAuthRequest' } );
} );

test( 'expired transactions and codes are rejected even before database TTL cleanup', async () => {
  const { service, repository } = setup();
  const started = await service.begin( { redirectUri, challenge: secret(), clientState: secret() } );
  const state = new URL( started.url ).searchParams.get( 'state' );
  repository.transactions.get( state ).expiresAt = new Date( 0 );
  await assert.rejects( service.callback( { state, code: 'code' } ), { code: 'invalidAuthRequest' } );
  const input = await login( service );
  repository.exchanges.get( digest( input.exchange.code ) ).expiresAt = new Date( 0 );
  await assert.rejects( service.exchange( input.exchange ), { code: 'invalidAuthRequest' } );
} );

test( 'cancelled or failed identity verification creates no session', async () => {
  const provider = {
    authorizeUrl: ( transaction ) => 'https://identity.test/?state=' + transaction.state,
    verify: async () => { throw new ApiError( 401, 'invalidIdentity' ); },
  };
  const { service, repository } = setup( provider );
  const started = await service.begin( { redirectUri, challenge: secret(), clientState: secret() } );
  const state = new URL( started.url ).searchParams.get( 'state' );
  const failed = new URL( await service.callback( { state, code: 'code' } ) );
  assert.equal( failed.searchParams.get( 'error' ), 'invalidIdentity' );
  assert.equal( failed.searchParams.has( 'code' ), false );
  const cancelled = await service.begin( { redirectUri, challenge: secret(), clientState: secret() } );
  const cancelState = new URL( cancelled.url ).searchParams.get( 'state' );
  const result = new URL( await service.callback( { state: cancelState, error: 'access_denied' } ) );
  assert.equal( result.searchParams.get( 'error' ), 'authCancelled' );
  assert.equal( repository.sessions.size, 0 );
  assert.equal( repository.exchanges.size, 0 );
} );

test( 'expired, fabricated and revoked sessions are rejected', async () => {
  const { service, repository } = setup();
  const value = await service.exchange( ( await login( service ) ).exchange );
  const authorization = 'Bearer ' + value.token;
  await assert.rejects( service.authenticate( 'Bearer ' + secret() ), { code: 'unauthorized' } );
  const session = await service.authenticate( authorization );
  await service.logout( session );
  await assert.rejects( service.authenticate( authorization ), { code: 'unauthorized' } );
  const second = await service.exchange( ( await login( service ) ).exchange );
  repository.sessions.get( digest( second.token ) ).expiresAt = new Date( 0 );
  await assert.rejects( service.authenticate( 'Bearer ' + second.token ), { code: 'unauthorized' } );
} );
