import test from 'node:test';
import assert from 'node:assert/strict';

// Temporary, explicitly requested end-to-end check of failed CI reporting.
test( 'CI reporting demonstration: intentional test failure', () => {
  assert.fail( 'Intentional CI reporting demonstration; remove after checking the Google report.' );
} );
