import { spawnSync } from 'node:child_process';
import { IMAGE_REPOSITORY } from '../../backend/deploy/imageReference.js';

export function registryFailureReason( output ) {
  if ( /unauthorized|forbidden|denied|insufficient.scope|\b40[13]\b/i.test( output ) ) return 'AUTHORIZATION';
  if ( /manifest unknown|not found|name unknown/i.test( output ) ) return 'NOT_FOUND';
  if ( /certificate|TLS handshake|x509/i.test( output ) ) return 'TLS';
  if ( /timeout|timed out|connection refused|no such host|network is unreachable/i.test( output ) ) return 'NETWORK';
  return 'DOCKER';
}

export function docker( args, { input, missing = false } = {} ) {
  const result = spawnSync( 'docker', args, { input, encoding: 'utf8', windowsHide: true,
    timeout: 300_000, maxBuffer: 4 * 1024 * 1024 } );
  if ( result.status === 0 ) return result.stdout.trim();
  const reason = registryFailureReason( result.stderr || '' );
  if ( missing && reason === 'NOT_FOUND' ) return null;
  const error = new Error( 'Registry operation failed. Check the job log and package permissions.' );
  error.code = reason;
  throw error;
}

export function registryLogin() {
  if ( !process.env.GH_TOKEN || !process.env.GITHUB_ACTOR ) throw new Error( 'Registry credentials are unavailable.' );
  docker( ['login', 'ghcr.io', '--username', process.env.GITHUB_ACTOR, '--password-stdin'], { input: process.env.GH_TOKEN } );
}

export function registryDigest( reference ) {
  const digest = JSON.parse( docker( ['buildx', 'imagetools', 'inspect', '--format', '{{json .Manifest}}', reference] ) ).digest;
  if ( !/^sha256:[a-f0-9]{64}$/.test( digest ) ) throw new Error( 'Registry returned an invalid digest.' );
  return IMAGE_REPOSITORY + '@' + digest;
}

export function imageTag( sha ) {
  if ( !/^[a-f0-9]{40}$/.test( sha || '' ) ) throw new Error( 'A full commit SHA is required.' );
  return IMAGE_REPOSITORY + ':' + sha;
}
