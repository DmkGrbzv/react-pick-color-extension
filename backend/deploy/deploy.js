import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IMAGE_REPOSITORY, validImage } from './imageReference.js';
const COMPOSE = fileURLToPath( new URL( './compose.yaml', import.meta.url ) );
const execute = promisify( execFile );
const delay = ( milliseconds ) => new Promise( ( resolve ) => setTimeout( resolve, milliseconds ) );

async function dockerCommand( args, env, timeout = 300_000 ) {
  try {
    const result = await execute( 'docker', args, { env, timeout, maxBuffer: 2 * 1024 * 1024, windowsHide: true } );
    return result.stdout.trim();
  } catch { throw new Error( 'Docker operation failed; inspect the staging container locally.' ); }
}

async function readState( filename ) {
  try { return JSON.parse( await readFile( filename, 'utf8' ) ); }
  catch ( error ) { if ( error.code === 'ENOENT' ) return { current: null, previous: null }; throw new Error( 'Staging state is unreadable.', { cause: error } ); }
}

async function saveState( filename, state ) {
  const temporary = filename + '.tmp';
  await writeFile( temporary, JSON.stringify( state, null, 2 ) + '\n', { mode: 0o600 } );
  await rename( temporary, filename );
}

async function waitForReady( context, image ) {
  const deadline = context.now() + context.timeoutSeconds * 1000;
  while ( context.now() < deadline ) {
    const id = await context.compose( image, ['ps', '--all', '--quiet', 'backend'], Math.max( 1, deadline - context.now() ) );
    if ( id ) {
      const state = await context.docker( ['inspect', '--format', '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}', id], Math.max( 1, deadline - context.now() ) );
      if ( state === 'running healthy' && context.now() < deadline ) return;
      if ( /^(exited|dead)\b/.test( state ) ) break;
    }
    await context.sleep( 1000 );
  }
  throw new Error( 'Staging API did not become ready within the deadline.' );
}

async function replaceBackend( context, image ) {
  await context.compose( image, ['up', '-d', '--no-build', '--no-deps', '--pull', 'never', 'backend'] );
  await waitForReady( context, image );
}

// Inject only external I/O for tests. Deployment never changes databases or volumes.
export async function deployBackend( options, dependencies = {} ) {
  const { envFile, stateDirectory, timeoutSeconds = 90 } = options;
  if ( !path.isAbsolute( envFile || '' ) || !path.isAbsolute( stateDirectory || '' ) ||
    !Number.isInteger( timeoutSeconds ) || timeoutSeconds < 1 || timeoutSeconds > 600 ) throw new Error( 'Invalid staging paths or timeout.' );
  if ( !( await stat( envFile ) ).isFile() ) throw new Error( 'Staging configuration must be a file.' );
  await mkdir( stateDirectory, { recursive: true, mode: 0o700 } );
  const lockPath = path.join( stateDirectory, 'deployment.lock' );
  const lock = await open( lockPath, 'wx', 0o600 ).catch( () => { throw new Error( 'Staging deployment is locked. Check the active deployment before removing a stale lock.' ); } );
  const stateFile = path.join( stateDirectory, 'deployment.json' );
  try {
    const state = await readState( stateFile );
    if ( state.pending && !options.rollback ) throw new Error( 'Staging has an interrupted deployment; use --rollback before another update.' );
    const requested = options.rollback ? state.pending ? state.current : state.previous : options.image;
    if ( !validImage( requested ) ) throw new Error( 'Use this repository image with a full SHA tag or digest; rollback requires a previous release.' );
    const env = { ...process.env, STAGING_ENV_FILE: envFile };
    const docker = ( args, timeout ) => ( dependencies.docker || dockerCommand )( args, env, timeout );
    const compose = ( image, args, timeout = 60_000 ) => ( dependencies.docker || dockerCommand )( [
      'compose', '--project-name', 'tintoom-staging', '--env-file', envFile, '-f', COMPOSE, ...args,
    ], { ...env, BACKEND_IMAGE: image }, timeout );
    const context = { docker, compose, timeoutSeconds, sleep: dependencies.sleep || delay, now: dependencies.now || Date.now };
    // Pull before touching the running release; resolve SHA tags to immutable digests.
    await docker( ['pull', requested] );
    const digests = JSON.parse( await docker( ['image', 'inspect', '--format', '{{json .RepoDigests}}', requested] ) );
    const target = digests.find( ( ref ) => ref.startsWith( IMAGE_REPOSITORY + '@sha256:' ) && validImage( ref ) );
    if ( !target ) throw new Error( 'Registry digest could not be verified.' );
    const id = await compose( target, ['ps', '--all', '--quiet', 'backend'] );
    const previous = id ? await docker( ['inspect', '--format', '{{.Config.Image}}', id] ) : null;
    if ( previous && !validImage( previous ) ) throw new Error( 'Existing backend image is outside the staging release contract.' );
    await saveState( stateFile, { ...state, current: previous, pending: target } );
    try {
      await replaceBackend( context, target );
    } catch {
      if ( previous ) {
        // The previous image remains cached. No rebuild, migration or volume removal.
        await replaceBackend( context, previous ).catch( () => { throw new Error( 'Deployment and rollback failed; staging needs operator recovery.' ); } );
        await saveState( stateFile, { ...state, current: previous, pending: null, failed: target } );
        throw new Error( 'Deployment failed; the previous backend was restored and is ready.' );
      }
      await compose( target, ['stop', 'backend'] );
      await saveState( stateFile, { ...state, current: null, pending: null, failed: target } );
      throw new Error( 'First deployment failed; the backend was stopped. No previous release is available.' );
    }
    const result = { current: target, previous: state.pending || previous === target ? state.previous : previous, pending: null };
    await saveState( stateFile, result );
    return result;
  } finally {
    await lock.close();
    await unlink( lockPath );
  }
}

async function main() {
  const result = await deployBackend( { image: process.argv[2], rollback: process.argv[2] === '--rollback',
    envFile: process.env.STAGING_ENV_FILE, stateDirectory: process.env.STAGING_STATE_DIR,
    timeoutSeconds: Number( process.env.STAGING_READY_TIMEOUT || 90 ) } );
  console.log( JSON.stringify( { status: 'ready', ...result } ) );
}

if ( process.argv[1] && pathToFileURL( path.resolve( process.argv[1] ) ).href === import.meta.url ) {
  main().catch( ( error ) => {
    // Only our static errors reach operator logs; never Docker output or env contents.
    const message = /^(Staging|Invalid staging|Use this|Registry digest|Existing backend|Deployment|First deployment)/.test( error.message ) ? error.message : 'Staging deployment failed.';
    console.error( message ); process.exitCode = 1;
  } );
}
