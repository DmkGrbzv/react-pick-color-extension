import test from 'node:test';
import assert from 'node:assert/strict';
import { appViewHash, readAppView } from '@/routes/appRoutes.js';

test( 'direct links select app screens while legacy entries and gradient links retain their meaning', () => {
  for ( const view of ['working', 'library', 'print'] ) {
    assert.equal( readAppView( appViewHash( view ) ), view );
  }
  assert.equal( readAppView( '', 'library' ), 'library' );
  assert.equal( readAppView( '', 'print' ), 'print' );
  assert.equal( readAppView( '#view=unknown' ), 'working' );
  assert.equal( readAppView( '#gradient=one&request=123', 'print' ), 'working' );
  assert.equal( readAppView( '#view=library&gradient=one' ), 'working' );
  assert.throws( () => appViewHash( 'https://outside.test' ), /Unknown app view/ );
} );
