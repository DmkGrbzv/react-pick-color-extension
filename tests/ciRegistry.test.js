import test from 'node:test';
import assert from 'node:assert/strict';
import { registryFailureReason } from '../scripts/ci/containerImage.js';

test( 'registry diagnostics distinguish missing manifests from authorization and transport failures', () => {
  for ( const [output, reason] of [
    ['manifest unknown', 'NOT_FOUND'], ['name unknown: not found', 'NOT_FOUND'],
    ['unauthorized: repository not found', 'AUTHORIZATION'], ['403 Forbidden', 'AUTHORIZATION'],
    ['x509: certificate has expired', 'TLS'], ['connection refused', 'NETWORK'],
    ['Docker operation failed', 'DOCKER'],
  ] ) assert.equal( registryFailureReason( output ), reason );
} );

test( 'registry diagnostics export fixed categories without copying token or password data', () => {
  for ( const output of ['unauthorized: Bearer private-token password=private', 'unknown private-response'] ) {
    const result = registryFailureReason( output );
    assert.ok( ['AUTHORIZATION', 'DOCKER'].includes( result ) );
    assert.ok( !result.includes( 'private' ) );
  }
} );
