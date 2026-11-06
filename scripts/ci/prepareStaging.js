import { mkdir, writeFile } from 'node:fs/promises';
import { docker, imageTag, registryDigest, registryLogin } from './containerImage.js';

const REPOSITORY = 'DmkGrbzv/react-pick-color-extension';
const REQUIRED_JOBS = ['Frontend', 'Backend', 'Backend Docker image', 'Publish backend image'];

async function github( suffix ) {
  const response = await fetch( `https://api.github.com/repos/${REPOSITORY}/${suffix}`, {
    headers: { Authorization: 'Bearer ' + process.env.GH_TOKEN, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout( 20_000 ), redirect: 'error',
  } );
  if ( !response.ok ) throw new Error( 'Cannot verify the checked publication in GitHub.' );
  return response.json();
}

async function prepare() {
  const sha = process.env.STAGING_COMMIT_SHA;
  const tag = imageTag( sha );
  if ( process.env.GITHUB_REF !== 'refs/heads/master' ) throw new Error( 'Prepare staging from master only.' );
  const runs = await github( `actions/workflows/ci.yml/runs?event=push&branch=master&head_sha=${sha}&per_page=30` );
  let verifiedRun;
  for ( const run of runs.workflow_runs ) {
    if ( run.status !== 'completed' || run.head_sha !== sha ) continue;
    const { jobs } = await github( `actions/runs/${run.id}/jobs?per_page=100` );
    // Google reporting may fail without blocking an otherwise checked publication.
    if ( REQUIRED_JOBS.every( ( name ) => jobs.some( ( job ) => job.name === name && job.conclusion === 'success' ) ) ) {
      verifiedRun = run; break;
    }
  }
  if ( !verifiedRun ) throw new Error( 'This SHA has no successful application checks and image publication.' );
  registryLogin();
  try {
    const image = registryDigest( tag );
    const release = { sha, image, checkedRun: verifiedRun.html_url, preparedAt: new Date().toISOString() };
    await mkdir( '.ci-reports/staging', { recursive: true } );
    await writeFile( '.ci-reports/staging/release.json', JSON.stringify( release, null, 2 ) + '\n' );
    await writeFile( '.ci-reports/staging/release.env', 'BACKEND_IMAGE=' + image + '\n' );
    console.log( 'Prepared staging release ' + image + '. No server connection or deployment was performed.' );
  } finally { docker( ['logout', 'ghcr.io'] ); }
}

prepare().catch( () => { console.error( 'Staging preparation failed: verify the SHA, checks and GHCR access.' ); process.exitCode = 1; } );
