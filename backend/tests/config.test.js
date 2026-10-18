import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

const env = {
  NODE_ENV: 'development', PUBLIC_API_URL: 'http://localhost:3001',
  MONGODB_URI: 'mongodb://localhost/?replicaSet=rs0', MONGODB_DATABASE: 'test',
  OIDC_ISSUER: 'https://accounts.google.com', OIDC_CLIENT_ID: 'client', OIDC_CLIENT_SECRET: 'secret',
  AUTH_REDIRECT_URIS: 'https://allowed.example.test/oauth',
  EXTENSION_ORIGINS: 'chrome-extension://' + 'a'.repeat( 32 ),
  SESSION_TTL_SECONDS: '86400',
};

test( 'configuration requires real identity settings, exact callbacks and an explicit session policy', () => {
  const config = readConfig( env );
  assert.equal( config.sessionSeconds, 86400 );
  assert.equal( config.maxItems, 256 );
  for ( const key of ['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'AUTH_REDIRECT_URIS', 'SESSION_TTL_SECONDS'] ) {
    assert.throws( () => readConfig( { ...env, [key]: '' } ) );
  }
} );

test( 'production forbids HTTP and malformed origins, callbacks and numeric limits', () => {
  for ( const overrides of [
    { NODE_ENV: 'production' }, { PUBLIC_API_URL: 'https://api.test/path' },
    { EXTENSION_ORIGINS: '*' }, { AUTH_REDIRECT_URIS: 'http://attacker.test' },
    { SESSION_TTL_SECONDS: '-1' }, { MAX_PALETTE_ITEMS: '257' }, { TRUST_PROXY_HOPS: 'true' },
  ] ) assert.throws( () => readConfig( { ...env, ...overrides } ) );
  assert.throws( () => readConfig( { ...env, NODE_ENV: 'production', PUBLIC_API_URL: 'https://api.test' } ), /TLS/ );
  assert.equal( readConfig( { ...env, NODE_ENV: 'production', PUBLIC_API_URL: 'https://api.test',
    MONGODB_URI: 'mongodb+srv://cluster.example.test/' } ).sessionSeconds, 86400 );
} );
