import { mkdir, writeFile } from 'node:fs/promises';
import { docker, imageTag, registryDigest, registryLogin } from './containerImage.js';

async function publish() {
  if ( process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/master' ||
    process.env.GITHUB_REPOSITORY !== 'DmkGrbzv/react-pick-color-extension' ) throw new Error( 'Publication context is not allowed.' );
  const tag = imageTag( process.env.GITHUB_SHA );
  const revision = docker( ['image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', 'palette-backend:ci'] );
  if ( revision !== process.env.GITHUB_SHA ) throw new Error( 'Checked image revision does not match the commit.' );
  registryLogin();
  try {
    const raw = docker( ['buildx', 'imagetools', 'inspect', '--raw', tag], { missing: true } );
    if ( raw ) {
      const localId = docker( ['image', 'inspect', '--format', '{{.Id}}', 'palette-backend:ci'] );
      let manifest = JSON.parse( raw );
      if ( manifest.manifests ) {
        const platform = docker( ['image', 'inspect', '--format', '{{.Os}}/{{.Architecture}}', 'palette-backend:ci'] );
        const selected = manifest.manifests.find( ( entry ) => entry.platform?.os + '/' + entry.platform?.architecture === platform );
        if ( !/^sha256:[a-f0-9]{64}$/.test( selected?.digest || '' ) ) throw new Error( 'Existing SHA manifest cannot be verified.' );
        manifest = JSON.parse( docker( ['buildx', 'imagetools', 'inspect', '--raw', tag.split( ':' )[0] + '@' + selected.digest] ) );
      }
      if ( manifest.config?.digest !== localId ) throw new Error( 'The SHA tag already exists with different contents; it will not be overwritten.' );
    } else {
      docker( ['tag', 'palette-backend:ci', tag] );
      docker( ['push', tag] );
    }
    const result = { sha: process.env.GITHUB_SHA, tag, image: registryDigest( tag ) };
    await mkdir( '.ci-reports/publication', { recursive: true } );
    await writeFile( '.ci-reports/publication/image.json', JSON.stringify( result, null, 2 ) + '\n' );
    console.log( JSON.stringify( result ) );
  } finally { docker( ['logout', 'ghcr.io'] ); }
}

publish().catch( () => { console.error( 'Backend image publication failed; the checked image and SHA tag were preserved.' ); process.exitCode = 1; } );
