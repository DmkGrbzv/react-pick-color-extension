import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const directory = new URL( '../dist/', import.meta.url );
const files = await readdir( directory, { recursive: true } );
const forbiddenPaths = /(^|[\\/])(backend|node_modules|tests|\.env[^\\/]*)($|[\\/])/;
const serverOnly = ['MONGODB_URI', 'OIDC_CLIENT_SECRET', 'mongodb/lib/', 'openid-client/build/'];
for ( const file of files ) {
  assert.ok( !forbiddenPaths.test( file ), 'Unexpected build path: ' + file );
  if ( !['.js', '.json', '.html'].includes( path.extname( file ) ) ) continue;
  const content = await readFile( new URL( file.replaceAll( '\\', '/' ), directory ), 'utf8' );
  for ( const marker of serverOnly ) assert.ok( !content.includes( marker ), 'Server configuration in build: ' + file );
}
const manifest = JSON.parse( await readFile( new URL( 'manifest.json', directory ), 'utf8' ) );
assert.ok( !manifest.host_permissions?.includes( '<all_urls>' ) );
console.log( 'Extension build verified: no backend, dependencies or server configuration (' + files.length + ' paths).' );
