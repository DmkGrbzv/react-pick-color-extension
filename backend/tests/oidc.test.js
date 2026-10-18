import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import * as oidc from 'openid-client';
import { OidcProvider } from '../src/auth/oidcProvider.js';
import { digest, secret } from '../src/auth/crypto.js';

const issuer = 'https://identity.example.test';
const audience = 'test-client';
const callback = 'https://api.example.test/v1/auth/callback';
const keys = generateKeyPairSync( 'rsa', { modulusLength: 2048 } );
const jwk = { ...keys.publicKey.export( { format: 'jwk' } ), kid: 'test', alg: 'RS256', use: 'sig' };

function jwt( claims, privateKey = keys.privateKey ) {
  const header = Buffer.from( JSON.stringify( { alg: 'RS256', kid: 'test' } ) ).toString( 'base64url' );
  const payload = Buffer.from( JSON.stringify( claims ) ).toString( 'base64url' );
  const content = header + '.' + payload;
  return content + '.' + sign( 'RSA-SHA256', Buffer.from( content ), privateKey ).toString( 'base64url' );
}

function setup( overrides = {}, privateKey, tokenError ) {
  const transaction = { state: secret(), nonce: secret(), providerVerifier: secret() };
  transaction.providerChallenge = digest( transaction.providerVerifier );
  const now = Math.floor( Date.now() / 1000 );
  const idToken = jwt( {
    iss: issuer, aud: audience, sub: 'verified-user', nonce: transaction.nonce,
    iat: now, exp: now + 300, email: 'user@example.test', email_verified: true,
    ...overrides,
  }, privateKey );
  const config = new oidc.Configuration( {
    issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
    jwks_uri: issuer + '/jwks', id_token_signing_alg_values_supported: ['RS256'],
  }, audience, 'test-secret' );
  config[oidc.customFetch] = async ( url, options ) => {
    if ( String( url ).endsWith( '/jwks' ) ) return Response.json( { keys: [jwk] } );
    if ( tokenError ) return Response.json( { error: tokenError, error_description: 'private-provider-details' }, { status: 401 } );
    assert.equal( new URLSearchParams( options.body ).get( 'code_verifier' ), transaction.providerVerifier );
    return Response.json( { access_token: 'unused', token_type: 'Bearer', id_token: idToken } );
  };
  oidc.enableNonRepudiationChecks( config );
  const provider = new OidcProvider( { client: config, issuer, callback } );
  return { provider, transaction };
}

test( 'OIDC verifies a signed identity and uses configured provider metadata', async () => {
  const { provider, transaction } = setup();
  const url = new URL( provider.authorizeUrl( transaction ) );
  assert.equal( url.origin, issuer );
  assert.equal( url.searchParams.get( 'code_challenge_method' ), 'S256' );
  assert.equal( url.searchParams.get( 'redirect_uri' ), callback );
  const identity = await provider.verify( { code: 'code', state: transaction.state }, transaction );
  assert.deepEqual( identity, { provider: issuer, sub: 'verified-user', email: 'user@example.test' } );
} );

test( 'OIDC rejects incorrect audience, issuer, nonce and expired tokens', async () => {
  for ( const overrides of [
    { aud: 'another-client' }, { iss: 'https://attacker.test' },
    { nonce: 'wrong' }, { exp: 1 },
  ] ) {
    const { provider, transaction } = setup( overrides );
    await assert.rejects( provider.verify( { code: 'code', state: transaction.state }, transaction ), { code: 'invalidIdentity' } );
  }
} );

test( 'OIDC rejects invalid signatures and substituted callback state', async () => {
  const attacker = generateKeyPairSync( 'rsa', { modulusLength: 2048 } );
  const invalid = setup( {}, attacker.privateKey );
  await assert.rejects( invalid.provider.verify( { code: 'code', state: invalid.transaction.state }, invalid.transaction ), { code: 'invalidIdentity' } );
  const { provider, transaction } = setup();
  await assert.rejects( provider.verify( { code: 'code', state: secret() }, transaction ), { code: 'invalidIdentity' } );
} );

test( 'rejected client credentials produce a safe configuration error', async () => {
  const { provider, transaction } = setup( {}, undefined, 'invalid_client' );
  await assert.rejects( provider.verify( { code: 'code', state: transaction.state }, transaction ),
    ( error ) => error.code === 'authConfiguration' && !error.message.includes( 'private-provider-details' ) );
} );
