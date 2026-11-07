import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deployBackend } from '../deploy/deploy.js';
import { IMAGE_REPOSITORY, validImage } from '../deploy/imageReference.js';

const PREVIOUS = IMAGE_REPOSITORY + '@sha256:' + 'a'.repeat( 64 );
const NEXT = IMAGE_REPOSITORY + '@sha256:' + 'b'.repeat( 64 );

async function fixture( context, { initial = PREVIOUS, failing = [] } = {} ) {
  const directory = await mkdtemp( path.join( tmpdir(), 'palette-deployment-test-' ) );
  context.after( async () => {
    assert.equal( path.dirname( directory ), path.resolve( tmpdir() ) );
    await rm( directory, { recursive: true, force: true } );
  } );
  const envFile = path.join( directory, 'staging.env' );
  await writeFile( envFile, 'OIDC_CLIENT_SECRET=fixture-not-exported\n' );
  let current = initial;
  let clock = 0;
  const replacements = [];
  const docker = async ( args, env ) => {
    assert.ok( !args.some( ( arg ) => ['down', '--volumes', 'build', 'mongo'].includes( arg ) ) );
    if ( args[0] === 'pull' ) return '';
    if ( args[0] === 'image' ) return JSON.stringify( [args.at( -1 ).includes( '@' ) ? args.at( -1 ) : NEXT] );
    if ( args[0] === 'inspect' ) {
      if ( args.includes( '{{.Config.Image}}' ) ) return current;
      return failing.includes( current ) ? 'running unhealthy' : 'running healthy';
    }
    if ( args.includes( 'ps' ) ) return current ? 'container-id' : '';
    if ( args.includes( 'up' ) ) { current = env.BACKEND_IMAGE; replacements.push( current ); return ''; }
    if ( args.includes( 'stop' ) ) { current = null; return ''; }
    assert.fail( 'Unexpected Docker operation' );
  };
  return { options: { image: NEXT, envFile, stateDirectory: directory, timeoutSeconds: 1 },
    dependencies: { docker, sleep: async () => { clock += 1000; }, now: () => clock }, replacements,
    state: async () => JSON.parse( await readFile( path.join( directory, 'deployment.json' ), 'utf8' ) ),
    directory };
}

test( 'deployment accepts only full SHA/digest references in the backend registry', () => {
  assert.ok( validImage( NEXT ) );
  assert.ok( validImage( IMAGE_REPOSITORY + ':' + 'a'.repeat( 40 ) ) );
  for ( const value of ['node:latest', IMAGE_REPOSITORY + ':latest', NEXT + ' --privileged', undefined] ) assert.ok( !validImage( value ) );
} );

test( 'a healthy deployment records the previous digest; explicit rollback uses that image', async ( context ) => {
  const fixtureData = await fixture( context );
  const { options, dependencies, state, replacements } = fixtureData;
  assert.equal( ( await deployBackend( options, dependencies ) ).previous, PREVIOUS );
  assert.equal( ( await state() ).current, NEXT );
  await deployBackend( { ...options, rollback: true }, dependencies );
  assert.deepEqual( replacements, [NEXT, PREVIOUS] );
  assert.equal( ( await state() ).current, PREVIOUS );
} );

test( 'an unready update automatically restores the previous healthy backend and still fails delivery', async ( context ) => {
  const { options, dependencies, replacements, state } = await fixture( context, { failing: [NEXT] } );
  await assert.rejects( deployBackend( options, dependencies ), /previous backend was restored/ );
  assert.deepEqual( replacements, [NEXT, PREVIOUS] );
  assert.equal( ( await state() ).current, PREVIOUS );
  assert.equal( ( await state() ).failed, NEXT );
} );

test( 'a failed first deployment stops the backend without changing any database or volume', async ( context ) => {
  const { options, dependencies, state } = await fixture( context, { initial: null, failing: [NEXT] } );
  await assert.rejects( deployBackend( options, dependencies ), /First deployment failed/ );
  assert.equal( ( await state() ).current, null );
} );

test( 'a failed rollback keeps recovery state; concurrent deployment locks are respected', async ( context ) => {
  const { options, dependencies, directory, state } = await fixture( context, { failing: [NEXT, PREVIOUS] } );
  await assert.rejects( deployBackend( options, dependencies ), /rollback failed/ );
  assert.equal( ( await state() ).pending, NEXT );
  await writeFile( path.join( directory, 'deployment.lock' ), 'another deployment' );
  await assert.rejects( deployBackend( options, dependencies ), /locked/ );
} );

test( 'pull failures never replace a running release', async ( context ) => {
  const { options, replacements } = await fixture( context );
  await assert.rejects( deployBackend( options, { docker: async () => { throw new Error( 'registry unavailable' ); } } ), /registry unavailable/ );
  assert.deepEqual( replacements, [] );
} );

test( 'repeating the current release preserves the previous rollback target', async ( context ) => {
  const { options, dependencies, state } = await fixture( context );
  await deployBackend( options, dependencies );
  await deployBackend( options, dependencies );
  assert.equal( ( await state() ).previous, PREVIOUS );
  await deployBackend( { ...options, rollback: true }, dependencies );
  assert.equal( ( await state() ).current, PREVIOUS );
} );

test( 'an interrupted deployment blocks updates and recovers the recorded release on rollback', async ( context ) => {
  const { options, dependencies, directory, state, replacements } = await fixture( context, { initial: NEXT } );
  await writeFile( path.join( directory, 'deployment.json' ), JSON.stringify( {
    current: PREVIOUS, previous: null, pending: NEXT,
  } ) );
  await assert.rejects( deployBackend( options, dependencies ), /interrupted deployment/ );
  assert.deepEqual( replacements, [] );
  await deployBackend( { ...options, rollback: true }, dependencies );
  assert.equal( ( await state() ).current, PREVIOUS );
  assert.equal( ( await state() ).pending, null );
  assert.deepEqual( replacements, [PREVIOUS] );
} );
