import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { brandingPlugin, resolveAppName } from '../scripts/branding.js';

test( 'brand names default, normalize and reject invalid manifest names', () => {
  assert.equal( resolveAppName(), 'Pickment' );
  assert.equal( resolveAppName( '  ' ), 'Pickment' );
  assert.equal( resolveAppName( ' Custom brand ' ), 'Custom brand' );
  assert.throws( () => resolveAppName( 'a'.repeat( 76 ) ) );
  assert.throws( () => resolveAppName( 'one\ntwo' ) );
} );

test( 'custom branding is safely rendered as text in all HTML entries', async () => {
  const name = 'Colors & </title><script>alert(1)</script>';
  const plugin = brandingPlugin( name );
  assert.equal( JSON.parse( plugin.config().define['import.meta.env.VITE_APP_NAME'] ), name );
  for ( const file of ['editor', 'sidepanel', 'library', 'print'] ) {
    const html = await readFile( new URL( '../' + file + '.html', import.meta.url ), 'utf8' );
    const dom = new JSDOM( plugin.transformIndexHtml( html ) );
    try {
      assert.equal( dom.window.document.title, name );
      assert.equal( dom.window.document.scripts.length, 1 );
      assert.equal( dom.window.document.querySelectorAll( 'link[rel="icon"]' ).length, 2 );
    } finally { dom.window.close(); }
  }
} );

test( 'manifest icons are PNG files with the declared square dimensions', async () => {
  const manifest = JSON.parse( await readFile( new URL( '../public/manifest.json', import.meta.url ) ) );
  assert.deepEqual( manifest.icons, manifest.action.default_icon );
  for ( const [size, file] of Object.entries( manifest.icons ) ) {
    const png = await readFile( new URL( '../public/' + file, import.meta.url ) );
    assert.equal( png.subarray( 1, 4 ).toString(), 'PNG' );
    assert.equal( png.readUInt32BE( 16 ), Number( size ) );
    assert.equal( png.readUInt32BE( 20 ), Number( size ) );
  }
} );
