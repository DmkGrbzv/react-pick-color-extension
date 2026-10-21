import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export function apiManifest( manifest, apiUrl ) {
  if ( !apiUrl ) return manifest;
  const url = new URL( apiUrl );
  const local = ['localhost', '127.0.0.1'].includes( url.hostname );
  if ( url.protocol !== 'https:' && !( local && url.protocol === 'http:' ) ) {
    throw new Error( 'VITE_PALETTE_API_URL requires HTTPS or a local development origin' );
  }
  if ( url.pathname !== '/' || url.username || url.password || url.search || url.hash ) {
    throw new Error( 'VITE_PALETTE_API_URL must be an origin without a path' );
  }
  return {
    ...manifest,
    permissions: [...manifest.permissions, 'identity'],
    // Chrome match patterns do not restrict ports. Restrict to the configured host.
    host_permissions: [url.protocol + '//' + url.hostname + '/*'],
  };
}

export function apiManifestPlugin( manifest ) {
  let output;
  return {
    name: 'api-manifest',
    configResolved( config ) { output = path.resolve( config.root, config.build.outDir ); },
    async writeBundle() {
      await writeFile( path.join( output, 'manifest.json' ), JSON.stringify( manifest, null, 2 ) + '\n' );
    },
  };
}
