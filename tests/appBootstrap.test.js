import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { readAppOptions } from '@/routes/appOptions.js';

test( 'all extension HTML entries use one React bootstrap with explicit surface and initial screen', async () => {
  for ( const [file, panel, initialPage] of [
    ['sidepanel.html', true, 'working'], ['editor.html', false, 'working'],
    ['library.html', false, 'library'], ['print.html', false, 'print'],
  ] ) {
    const html = await readFile( new URL( '../' + file, import.meta.url ), 'utf8' );
    const dom = new JSDOM( html );
    try {
      const document = dom.window.document;
      assert.equal( document.querySelector( 'script[type="module"]' ).getAttribute( 'src' ), '/src/main.jsx', file );
      assert.deepEqual( readAppOptions( document.getElementById( 'root' ).dataset ), { panel, initialPage }, file );
    } finally {
      dom.window.close();
    }
  }
} );

test( 'bootstrap options reject unknown screens and do not infer mode from a URL', () => {
  assert.deepEqual( readAppOptions(), { panel: false, initialPage: 'working' } );
  assert.deepEqual( readAppOptions( { surface: 'other', initialView: 'unknown' } ), { panel: false, initialPage: 'working' } );
} );
