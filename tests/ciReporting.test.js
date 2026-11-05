import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, summarizeOutput, safeResult } from '../scripts/ci/checkResults.js';
import { createReport, renderReport, validateReport } from '../scripts/ci/report.js';
import { publishReport } from '../scripts/ci/googleDocReport.js';
import { deferred } from './helpers/extensionStorage.js';

const DOCUMENT_ID = 'test-document-only-1234567890';
const credentials = { documentId: DOCUMENT_ID, accessToken: 'test-access-token-never-exported' };
const context = { repository: 'owner/repo', workflow: '.github/workflows/ci.yml', ref: 'refs/heads/master',
  event: 'push', sha: 'a'.repeat( 40 ), runId: '10', runNumber: '1', attempt: '1' };
const now = '2026-11-05T12:30:00.000Z';

function needs( results = {} ) {
  return Object.fromEntries( Object.entries( CHECKS ).map( ( [job, checks] ) => [job, {
    result: results[job] || 'success', outputs: { attempt: '1',
      ...Object.fromEntries( Object.keys( checks ).map( ( check ) => [check, 'success'] ) ),
      artifact: `https://github.com/owner/repo/actions/runs/10/artifacts/${job === 'frontend' ? 100 : 101}` },
  }] ) );
}

function report( overrides = {} ) {
  return createReport( { ...context, ...overrides }, needs(), {}, now );
}

function document( text = '', revisionId = 'revision-1' ) {
  return { documentId: DOCUMENT_ID, revisionId, tabs: [{ tabProperties: { tabId: 'tab-one' },
    documentTab: { body: { content: [
      { endIndex: 1, sectionBreak: {} },
      { startIndex: 1, endIndex: text.length + 2, paragraph: { elements: [{ textRun: { content: text + '\n' } }] } },
    ] } } }] };
}

function googleFixture( beforeWrite ) {
  let current = document();
  let writes = 0;
  const calls = [];
  return {
    get writes() { return writes; },
    get text() { return current.tabs[0].documentTab.body.content[1].paragraph.elements[0].textRun.content; },
    calls,
    async request( url, options ) {
      assert.ok( url.startsWith( 'https://docs.googleapis.com/v1/documents/' + DOCUMENT_ID ) );
      assert.equal( options.headers.Authorization, 'Bearer ' + credentials.accessToken );
      assert.equal( options.redirect, 'error' );
      calls.push( { url, method: options.method } );
      if ( options.method === 'GET' ) return Response.json( current );
      assert.ok( url.endsWith( ':batchUpdate' ) );
      const body = JSON.parse( options.body );
      await beforeWrite?.( body );
      if ( body.writeControl.requiredRevisionId !== current.revisionId ) return Response.json( {}, { status: 400 } );
      const insert = body.requests.at( -1 ).insertText;
      assert.equal( insert.location.tabId, 'tab-one' );
      assert.equal( insert.location.index, 1 );
      if ( body.requests.length === 2 ) {
        assert.deepEqual( body.requests[0].deleteContentRange.range, {
          startIndex: 1, endIndex: current.tabs[0].documentTab.body.content.at( -1 ).endIndex - 1, tabId: 'tab-one',
        } );
      }
      current = document( insert.text, 'revision-' + ( ++writes + 1 ) );
      return Response.json( { documentId: DOCUMENT_ID } );
    },
  };
}

test( 'diagnostics export only allowlisted metrics and fixed messages, never free-form secrets', () => {
  const privateValues = ['ghp_private', 'Bearer secret-token', 'Cookie: session=private',
    'password=private', 'mongodb://user:private@host/db', '.env: OIDC_CLIENT_SECRET=private'];
  const summary = summarizeOutput( privateValues.join( '\n' ) +
    '\n# tests 2\n# pass 1\n# fail 1\n# duration_ms 12.5\ncode: ERR_ASSERTION\n', 1 );
  const records = { frontend: { tests: { schema: 1, job: 'frontend', check: 'tests', runId: '10', attempt: '1',
    exitCode: 1, ...summary, raw: privateValues.join( '\n' ), metrics: { ...summary.metrics, token: 'private' } } } };
  const states = needs( { frontend: 'failure' } );
  states.frontend.outputs.tests = 'failure';
  states.frontend.outputs.artifact += '?token=private';
  const prepared = createReport( context, states, records, now );
  const serialized = JSON.stringify( prepared ) + renderReport( prepared );
  for ( const secret of [...privateValues, 'private', 'raw', 'secret-token'] ) assert.ok( !serialized.includes( secret ), secret );
  assert.ok( serialized.includes( 'assertion failed' ) );
  assert.ok( serialized.includes( 'tests=2, pass=1, fail=1' ) );
  assert.ok( serialized.includes( 'UTC' ) && serialized.includes( context.sha ) );
  assert.ok( serialized.includes( '/commit/' + context.sha ) && serialized.includes( '/actions/runs/10' ) );
  assert.equal( safeResult( { metrics: { tests: 'token', pass: -1 }, diagnosticCodes: ['unknown token'] } ).diagnosticCodes.length, 0 );
} );

test( 'report preserves failed, skipped and cancelled results and explicitly marks missing diagnostics', () => {
  for ( const state of ['failure', 'skipped', 'cancelled'] ) {
    const prepared = createReport( context, needs( { backend: state } ), {}, now );
    assert.ok( renderReport( prepared ).includes( 'backend: ' + state ) );
    assert.ok( renderReport( prepared ).includes( 'metrics unavailable' ) );
    assert.ok( !renderReport( prepared ).includes( 'tests=0' ) );
  }
  assert.throws( () => createReport( { ...context, ref: 'refs/heads/feature' }, needs() ), /unauthorized/ );
  assert.throws( () => createReport( { ...context, event: 'pull_request' }, needs() ), /unauthorized/ );
  assert.throws( () => validateReport( { ...report(), generatedAt: undefined } ), /schema/ );
} );

test( 'report-only retries reuse the original check attempt and ignore records from other attempts', () => {
  const records = { backend: { tests: { schema: 1, job: 'backend', check: 'tests', runId: '10', attempt: '1',
    exitCode: 0, metrics: { tests: 34, pass: 34 }, diagnosticCodes: [] } } };
  const prepared = createReport( { ...context, attempt: '2' }, needs(), records, now );
  assert.equal( prepared.jobs.backend.attempt, '1' );
  assert.equal( prepared.jobs.backend.checks.tests.record.metrics.pass, 34 );
  records.backend.tests.attempt = '2';
  assert.equal( createReport( { ...context, attempt: '2' }, needs(), records, now ).jobs.backend.checks.tests.record, null );
} );

test( 'architecture and test summaries are extracted without copying source lines', () => {
  const result = summarizeOutput( 'Architecture verified: 113 modules, 256 internal imports, 0 cycles, 0 boundary violations.\n', 0 );
  assert.deepEqual( result.metrics, { modules: 113, imports: 256, cycles: 0, violations: 0 } );
  assert.equal( summarizeOutput( 'Import cycle: private -> token', 1 ).diagnosticCodes.includes( 'architecture' ), true );
} );

test( 'Google publication replaces atomically, verifies contents and is idempotent for the same attempt', async () => {
  const google = googleFixture();
  assert.deepEqual( await publishReport( report(), credentials, google.request ), { status: 'published-and-verified' } );
  assert.equal( google.writes, 1 );
  assert.ok( google.calls.filter( ( call ) => call.method === 'GET' ).length >= 2 );
  assert.deepEqual( await publishReport( report(), credentials, google.request ), { status: 'already-published' } );
  assert.equal( google.writes, 1 );
  await publishReport( report( { attempt: '2' } ), credentials, google.request );
  assert.equal( google.writes, 2 );
  assert.deepEqual( await publishReport( report(), credentials, google.request ), { status: 'superseded' } );
  assert.equal( google.writes, 2 );
} );

test( 'an old run, even rerun many times, cannot replace a newer run', async () => {
  const google = googleFixture();
  await publishReport( report( { runId: '20', runNumber: '2' } ), credentials, google.request );
  const latest = google.text;
  assert.deepEqual( await publishReport( report( { attempt: '99' } ), credentials, google.request ), { status: 'superseded' } );
  assert.equal( google.text, latest );
  assert.equal( google.writes, 1 );
} );

test( 'a lost write response is recovered without a duplicate Google update', async () => {
  const google = googleFixture();
  let responseLost = false;
  const request = async ( url, options ) => {
    const response = await google.request( url, options );
    if ( options.method === 'POST' && !responseLost ) {
      responseLost = true;
      throw new Error( 'response lost after committing the update' );
    }
    return response;
  };
  assert.deepEqual( await publishReport( report(), credentials, request ), { status: 'already-published' } );
  assert.equal( google.writes, 1 );
} );

test( 'revision checking prevents an older in-flight writer from overwriting a newer report', async () => {
  const waiting = deferred();
  const release = deferred();
  const google = googleFixture( async ( body ) => {
    const text = body.requests.at( -1 ).insertText.text;
    if ( text.includes( '"runNumber":"1"' ) ) { waiting.resolve(); await release.promise; }
  } );
  const older = publishReport( report(), credentials, google.request );
  await waiting.promise;
  await publishReport( report( { runId: '20', runNumber: '2' } ), credentials, google.request );
  release.resolve();
  assert.deepEqual( await older, { status: 'superseded' } );
  assert.equal( google.writes, 1 );
  assert.ok( google.text.includes( '"runNumber":"2"' ) );
} );

test( 'Google errors fail publication with safe codes without leaking an API response or token', async () => {
  for ( const status of [401, 403, 500] ) {
    const request = async () => new Response( 'Bearer private-token password=private', { status } );
    await assert.rejects( publishReport( report(), credentials, request ), { message: 'google-http-' + status } );
  }
  await assert.rejects( publishReport( report(), credentials, async () => { throw new Error( credentials.accessToken ); } ),
    { message: 'google-network-error' } );
} );

test( 'multiple tabs and an unverifiable write fail without claiming successful delivery', async () => {
  let writes = 0;
  const multiple = document();
  multiple.tabs.push( structuredClone( multiple.tabs[0] ) );
  await assert.rejects( publishReport( report(), credentials, async () => Response.json( multiple ) ), /single-tab/ );
  await assert.rejects( publishReport( report(), credentials, async ( url, options ) => {
    if ( options.method === 'POST' ) { writes++; return Response.json( {} ); }
    return Response.json( document() );
  } ), /verification-failed/ );
  assert.equal( writes, 1 );
} );
