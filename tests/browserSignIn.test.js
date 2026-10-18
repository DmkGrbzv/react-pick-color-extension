import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSignIn } from '@/cloud/browserSignIn.js';

function fixture( { failure, browserError } ) {
  const redirect = 'https://extension.example.test/oauth';
  let clientState;
  const http = {
    async request( path, options ) {
      assert.equal( path, '/v1/auth/start', 'Failures must not exchange a code' );
      clientState = options.body.clientState;
      return { url: 'https://identity.example.test/authorize' };
    },
  };
  const api = { identity: {
    getRedirectURL: () => redirect,
    async launchWebAuthFlow() {
      if ( browserError ) throw new Error( browserError );
      const url = new URL( redirect );
      url.searchParams.set( 'state', clientState );
      url.searchParams.set( 'error', failure );
      return url.href;
    },
  } };
  return new BrowserSignIn( { api, http } );
}

test( 'browser distinguishes cancellation from an authorization window failure', async () => {
  await assert.rejects( fixture( { browserError: 'The user did not approve access.' } ).signIn(), { code: 'authCancelled' } );
  await assert.rejects( fixture( { browserError: 'Authorization page could not be loaded.' } ).signIn(), { code: 'authFlowFailed' } );
} );

test( 'trusted callback errors reach the UI as safe codes without code exchange', async () => {
  for ( const failure of ['authCancelled', 'authConfiguration', 'invalidIdentity'] ) {
    await assert.rejects( fixture( { failure } ).signIn(), { code: failure } );
  }
  await assert.rejects( fixture( { failure: 'private-server-details' } ).signIn(), { code: 'invalidAuthRequest' } );
} );
