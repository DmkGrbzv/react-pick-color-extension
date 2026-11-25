import test from 'node:test';
import assert from 'node:assert/strict';
import { isCloudEnabled, cloudEnabled } from '@/constants/features.js';
import { apiUrl } from '@/api/config.js';

test( 'cloud is off unless explicitly enabled by the public build flag', () => {
  for ( const value of [undefined, null, false, true, '', 'false', 'TRUE', '1', ' true '] ) assert.equal( isCloudEnabled( value ), false );
  assert.equal( isCloudEnabled( 'true' ), true );
  assert.equal( cloudEnabled, false );
  assert.equal( apiUrl, '' );
} );
