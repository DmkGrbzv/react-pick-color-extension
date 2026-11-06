import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasConnectionError } from '../scripts/atlasConnectionError.js';

test( 'Atlas diagnostics distinguish DNS, authentication, permissions, TLS, network and timeout', () => {
  for ( const [error, category] of [
    [{ code: 'ECONNREFUSED', syscall: 'querySrv' }, 'DNS'],
    [{ code: 'ETIMEOUT' }, 'DNS'],
    [{ code: 18 }, 'AUTH'],
    [{ code: 8000, message: 'bad auth : authentication failed' }, 'AUTH'],
    [{ code: 13 }, 'PERMISSIONS'],
    [{ code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, 'TLS'],
    [{ code: 'ECONNRESET' }, 'NETWORK'],
    [{ name: 'MongoServerSelectionError' }, 'TIMEOUT'],
    [{ name: 'MongoParseError' }, 'CONFIG'],
  ] ) assert.ok( atlasConnectionError( error ).startsWith( '[' + category + ']' ) );
} );

test( 'Atlas diagnostics inspect nested topology failures before a generic selection timeout', () => {
  const error = { name: 'MongoServerSelectionError', reason: { servers: new Map( [
    ['private-host', { error: { cause: { code: 'CERT_HAS_EXPIRED' } } }],
  ] ) } };
  assert.ok( atlasConnectionError( error ).startsWith( '[TLS]' ) );
} );

test( 'Atlas diagnostics hide arbitrary secret-bearing fields and tolerate circular errors', () => {
  const error = { name: 'private-name', code: 'private-code', message: 'mongodb://user:private-password@host/db',
    stack: 'Bearer private-token', hostname: 'private-host' };
  error.cause = error;
  const result = atlasConnectionError( error );
  assert.ok( result.startsWith( '[UNKNOWN]' ) );
  assert.ok( !result.includes( 'private' ) );
  assert.ok( atlasConnectionError( undefined ).startsWith( '[UNKNOWN]' ) );
} );
