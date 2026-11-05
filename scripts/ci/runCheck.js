import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, summarizeOutput } from './checkResults.js';

const root = fileURLToPath( new URL( '../../', import.meta.url ) );
const MAX_CAPTURE = 256 * 1024;

async function main() {
  const [job, check] = process.argv.slice( 2 );
  const args = Object.hasOwn( CHECKS, job ) && Object.hasOwn( CHECKS[job], check ) ? CHECKS[job][check] : null;
  if ( !args ) throw new Error( 'Unknown CI check' );
  const directory = path.join( root, '.ci-reports', job );
  const filename = path.join( directory, check + '.json' );
  const identity = { schema: 1, job, check, runId: process.env.GITHUB_RUN_ID || '0',
    attempt: process.env.GITHUB_RUN_ATTEMPT || '1' };
  await mkdir( directory, { recursive: true } );
  await writeFile( filename, JSON.stringify( { ...identity, exitCode: null, metrics: {}, diagnosticCodes: [] } ) );
  let captured = '';
  const child = spawn( process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: job === 'backend' ? path.join( root, 'backend' ) : root,
    // Commands and arguments come only from CHECKS, never from workflow/user data.
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  } );
  const capture = ( stream, chunk ) => {
    stream.write( chunk );
    captured = ( captured + chunk.toString() ).slice( -MAX_CAPTURE );
  };
  child.stdout.on( 'data', ( chunk ) => capture( process.stdout, chunk ) );
  child.stderr.on( 'data', ( chunk ) => capture( process.stderr, chunk ) );
  const interrupt = () => child.kill( 'SIGTERM' );
  process.once( 'SIGTERM', interrupt );
  process.once( 'SIGINT', interrupt );
  const result = await new Promise( ( resolve ) => {
    child.once( 'error', () => resolve( { exitCode: 1 } ) );
    child.once( 'close', ( code, signal ) => resolve( { exitCode: code ?? 143, signal } ) );
  } );
  process.removeListener( 'SIGTERM', interrupt );
  process.removeListener( 'SIGINT', interrupt );
  const summary = summarizeOutput( captured, result.exitCode );
  if ( result.signal ) summary.diagnosticCodes = ['interrupted'];
  await writeFile( filename, JSON.stringify( { ...identity, ...summary, exitCode: result.exitCode }, null, 2 ) + '\n' );
  process.exitCode = result.exitCode;
}

main().catch( () => { console.error( 'CI check capture failed; no raw diagnostics were saved.' ); process.exitCode = 1; } );
