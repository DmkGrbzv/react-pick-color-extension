import { spawnSync } from 'node:child_process';
import { IMAGE_REPOSITORY } from '../../backend/deploy/imageReference.js';

export { IMAGE_REPOSITORY };

export function docker( args, { input, missing = false } = {} ) {
  const result = spawnSync( 'docker', args, { input, encoding: 'utf8', windowsHide: true,
    timeout: 300_000, maxBuffer: 4 * 1024 * 1024 } );
  if ( result.status === 0 ) return result.stdout.trim();
  if ( missing && /manifest unknown|not found|name unknown/i.test( result.stderr || '' ) ) return null;
  throw new Error( 'Registry operation failed. Check the job log and package permissions.' );
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
