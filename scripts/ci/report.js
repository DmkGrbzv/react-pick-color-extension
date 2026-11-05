import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHECKS, DIAGNOSTICS, safeResult } from './checkResults.js';

const STATES = ['success', 'failure', 'cancelled', 'skipped'];
const NUMBER = /^[1-9]\d{0,19}$/;
export const WORKFLOW = '.github/workflows/ci.yml';

export function normalizeContext( value ) {
  if ( !/^[\w.-]+\/[\w.-]+$/.test( value?.repository ) || value.workflow !== WORKFLOW ||
    value.ref !== 'refs/heads/master' || !['push', 'workflow_dispatch'].includes( value.event ) ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test( value.sha ) ||
    !['runId', 'runNumber', 'attempt'].every( ( key ) => typeof value[key] === 'string' && NUMBER.test( value[key] ) ) ) {
    throw new Error( 'Invalid or unauthorized CI report context' );
  }
  return Object.fromEntries( ['repository', 'workflow', 'ref', 'event', 'sha', 'runId', 'runNumber', 'attempt']
    .map( ( key ) => [key, value[key]] ) );
}

export function createReport( context, needs, records = {}, generatedAt = new Date().toISOString() ) {
  const identity = normalizeContext( context );
  if ( !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test( generatedAt ) || !Number.isFinite( Date.parse( generatedAt ) ) ) {
    throw new Error( 'Invalid report timestamp' );
  }
  const jobs = {};
  for ( const [job, checks] of Object.entries( CHECKS ) ) {
    const supplied = needs?.[job];
    const suppliedAttempt = supplied?.outputs?.attempt || '';
    const attempt = NUMBER.test( suppliedAttempt ) && BigInt( suppliedAttempt ) <= BigInt( identity.attempt ) ? suppliedAttempt : null;
    const artifact = supplied?.outputs?.artifact || '';
    const artifactPrefix = `https://github.com/${identity.repository}/actions/runs/${identity.runId}/artifacts/`;
    const entry = { result: STATES.includes( supplied?.result ) ? supplied.result : 'unknown', attempt,
      artifact: artifact.startsWith( artifactPrefix ) && /^\d+$/.test( artifact.slice( artifactPrefix.length ) ) ? artifact : null,
      checks: {} };
    for ( const check of Object.keys( checks ) ) {
      const record = records[job]?.[check];
      const valid = record?.schema === 1 && record.job === job && record.check === check &&
        record.runId === identity.runId && record.attempt === attempt;
      entry.checks[check] = { status: STATES.includes( supplied?.outputs?.[check] ) ? supplied.outputs[check] : 'unknown',
        record: valid ? safeResult( record ) : null };
    }
    jobs[job] = entry;
  }
  return { schema: 1, context: identity, generatedAt, jobs };
}

// Revalidation makes publication safe even if an artifact has unexpected fields.
export function validateReport( value ) {
  if ( value?.schema !== 1 || typeof value.generatedAt !== 'string' ) throw new Error( 'Invalid report schema' );
  const needs = {};
  const records = {};
  for ( const job of Object.keys( CHECKS ) ) {
    const entry = value.jobs?.[job];
    needs[job] = { result: entry?.result, outputs: { attempt: entry?.attempt, artifact: entry?.artifact } };
    records[job] = {};
    for ( const check of Object.keys( CHECKS[job] ) ) {
      needs[job].outputs[check] = entry?.checks?.[check]?.status;
      if ( entry?.checks?.[check]?.record ) records[job][check] = { ...entry.checks[check].record,
        schema: 1, job, check, runId: value.context?.runId, attempt: entry.attempt };
    }
  }
  return createReport( value.context, needs, records, value.generatedAt );
}

export function renderReport( value ) {
  const report = validateReport( value );
  const { context } = report;
  const runUrl = `https://github.com/${context.repository}/actions/runs/${context.runId}`;
  const lines = ['logs github - latest CI report', `Generated: ${report.generatedAt} (UTC)`,
    'Branch: master', `Commit: ${context.sha}`, `Commit URL: https://github.com/${context.repository}/commit/${context.sha}`,
    `Run: ${runUrl}/attempts/${context.attempt}`, `Run number: ${context.runNumber}; attempt: ${context.attempt}`, ''];
  for ( const [job, entry] of Object.entries( report.jobs ) ) {
    lines.push( `${job}: ${entry.result}; check attempt: ${entry.attempt || 'unavailable'}` );
    for ( const [check, item] of Object.entries( entry.checks ) ) {
      const metrics = Object.entries( item.record?.metrics || {} ).map( ( [key, number] ) => `${key}=${number}` ).join( ', ' );
      lines.push( `  ${check}: ${item.status}${metrics ? '; ' + metrics : ''}` );
      if ( !item.record ) lines.push( '    Diagnostic report missing, invalid or from another attempt; metrics unavailable.' );
      for ( const code of item.record?.diagnosticCodes || [] ) lines.push( '    ' + DIAGNOSTICS[code] );
    }
    const lint = entry.checks.lint?.record;
    if ( job === 'frontend' ) lines.push( '  Architecture: ' + ( entry.checks.lint.status === 'success' &&
      lint?.metrics.cycles === 0 && lint.metrics.violations === 0 ? 'verified (see lint metrics)' :
      lint?.diagnosticCodes.includes( 'architecture' ) ? 'failure' : 'not reported / not reached' ) );
    lines.push( `  Full logs: ${runUrl}/attempts/${entry.attempt || context.attempt} (${job} job)`,
      '  Sanitized artifact: ' + ( entry.artifact || 'unavailable; see run artifacts' ), '' );
  }
  lines.push( `Run artifacts (retained 7 days): ${runUrl}`,
    'Job status also includes checkout, setup and artifact-upload failures; see the Actions log.',
    'Only allowlisted metrics and diagnostic codes are exported; detailed messages remain in Actions.' );
  const text = lines.join( '\n' ) + '\n';
  if ( text.length > 24_000 ) throw new Error( 'Report exceeds its size limit' );
  return text;
}

export const reportDigest = ( report ) => createHash( 'sha256' ).update( renderReport( report ) ).digest( 'hex' );

async function readSmallJson( filename ) {
  if ( ( await stat( filename ) ).size > 64 * 1024 ) throw new Error( 'Input exceeds its size limit' );
  return JSON.parse( await readFile( filename, 'utf8' ) );
}

async function prepare() {
  const args = process.argv.slice( 2 );
  const fixture = args.includes( '--context' ) ? args[args.indexOf( '--context' ) + 1] : null;
  const input = fixture ? await readSmallJson( fixture ) : {
    context: { repository: process.env.GITHUB_REPOSITORY, workflow: WORKFLOW, ref: process.env.GITHUB_REF,
      event: process.env.GITHUB_EVENT_NAME, sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
      runNumber: process.env.GITHUB_RUN_NUMBER, attempt: process.env.GITHUB_RUN_ATTEMPT },
    needs: JSON.parse( process.env.CI_NEEDS_JSON || '{}' ),
  };
  const context = normalizeContext( input.context );
  const records = input.records || {};
  if ( !fixture ) for ( const job of Object.keys( CHECKS ) ) {
    const attempt = input.needs?.[job]?.outputs?.attempt;
    if ( !NUMBER.test( attempt || '' ) ) continue;
    records[job] = {};
    for ( const check of Object.keys( CHECKS[job] ) ) {
      const filename = path.join( '.ci-reports', 'downloads', `ci-checks-${job}-${context.runId}-${attempt}`, check + '.json' );
      try { records[job][check] = await readSmallJson( filename ); }
      catch { /* Missing/corrupt diagnostics are explicit in the report, not a passing result. */ }
    }
  }
  const report = createReport( context, input.needs, records );
  const text = renderReport( report );
  await mkdir( '.ci-reports/report', { recursive: true } );
  await writeFile( '.ci-reports/report/report.json', JSON.stringify( report, null, 2 ) + '\n' );
  await writeFile( '.ci-reports/report/report.txt', text );
  console.log( args.includes( '--dry-run' ) ? text : 'Prepared sanitized CI report; no Google request has been made.' );
}

if ( process.argv[1] && pathToFileURL( path.resolve( process.argv[1] ) ).href === import.meta.url ) {
  prepare().catch( () => { console.error( 'CI report preparation failed (invalid context, input or filesystem).' ); process.exitCode = 1; } );
}
