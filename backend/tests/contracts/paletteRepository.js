import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const snapshot = { name: 'Mixed', items: [
  { type: 'color', hex: '#AABBCC' },
  { type: 'gradient', gradientType: 'linear', direction: 'left',
    stops: [{ hex: '#112233', position: 9 }, { hex: '#FFFFFF', position: 75 }] },
] };
const input = ( ownerId, overrides = {} ) => ( { ownerId, key: randomUUID(), snapshot,
  payloadHash: 'hash', maximum: 3, ...overrides } );

export function paletteRepositoryContract( label, factory ) {
  test( label + ': neutral entities, owner isolation and detached results', async ( context ) => {
    const { palettes, owner, other } = await factory( context );
    const { palette, created } = await palettes.create( input( owner ) );
    assert.equal( created, true );
    assert.deepEqual( Object.keys( palette ).sort(), ['createdAt', 'id', 'items', 'name', 'ownerId'] );
    assert.match( palette.id, /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/ );
    assert.ok( palette.createdAt instanceof Date );
    assert.deepEqual( palette.items, snapshot.items );
    palette.items[0].hex = '#000000';
    assert.deepEqual( ( await palettes.find( owner, palette.id ) ).items, snapshot.items );
    assert.equal( await palettes.find( other, palette.id ), null );
    assert.equal( await palettes.find( owner, 'missing' ), null );
    assert.equal( await palettes.rename( other, palette.id, 'Stolen' ), null );
    assert.equal( await palettes.rename( owner, 'missing', 'Absent' ), null );
    assert.equal( await palettes.remove( other, palette.id ), false );
    assert.equal( await palettes.remove( owner, 'missing' ), false );
    assert.deepEqual( await palettes.list( other, { cursor: null, limit: 2 } ), { palettes: [], continuation: null } );
    const renamed = await palettes.rename( owner, palette.id, 'Renamed' );
    assert.equal( renamed.id, palette.id );
    assert.equal( renamed.name, 'Renamed' );
    assert.deepEqual( renamed.items, snapshot.items );
  } );

  test( label + ': concurrent retries, conflicts and owner-scoped keys', async ( context ) => {
    const { palettes, owner, other, quota } = await factory( context );
    const request = input( owner, { maximum: 1 } );
    const results = await Promise.all( Array.from( { length: 6 }, () => palettes.create( request ) ) );
    assert.equal( new Set( results.map( ( result ) => result.palette.id ) ).size, 1 );
    assert.equal( results.filter( ( result ) => result.created ).length, 1 );
    assert.equal( await quota( owner ), 1 );
    await assert.rejects( palettes.create( { ...request, payloadHash: 'changed', snapshot: { ...snapshot, name: 'Changed' } } ), { code: 'saveConflict' } );
    assert.equal( await quota( owner ), 1 );
    assert.notEqual( ( await palettes.create( { ...request, ownerId: other } ) ).palette.id, results[0].palette.id );
    await assert.rejects( palettes.create( input( 'missing' ) ), { code: 'paletteLimit' } );
  } );

  test( label + ': parallel distinct saves respect quota and atomic delete frees it once', async ( context ) => {
    const { palettes, owner, quota } = await factory( context );
    const request = input( owner );
    const first = await palettes.create( request );
    const results = await Promise.allSettled( Array.from( { length: 7 }, () => palettes.create( input( owner ) ) ) );
    assert.equal( results.filter( ( value ) => value.status === 'fulfilled' ).length, 2 );
    for ( const failure of results.filter( ( value ) => value.status === 'rejected' ) ) assert.equal( failure.reason.code, 'paletteLimit' );
    assert.equal( await quota( owner ), 3 );
    assert.equal( ( await palettes.list( owner, { cursor: null, limit: 50 } ) ).palettes.length, 3 );
    await Promise.all( Array.from( { length: 5 }, () => palettes.remove( owner, first.palette.id ) ) );
    assert.equal( await quota( owner ), 2 );
    assert.equal( await palettes.find( owner, first.palette.id ), null );
    assert.equal( await palettes.rename( owner, first.palette.id, 'Restore' ), null );
    await assert.rejects( palettes.create( request ), { code: 'snapshotDeleted' } );
    await palettes.create( input( owner ) );
    assert.equal( await quota( owner ), 3 );
    assert.equal( ( await palettes.list( owner, { cursor: null, limit: 50 } ) ).palettes.length, 3 );
  } );

  test( label + ': failed quota update rolls back deletion and keeps content', async ( context ) => {
    const { palettes, owner, quota, setQuota } = await factory( context );
    const request = input( owner );
    const { palette } = await palettes.create( request );
    await setQuota( owner, 0 );
    await assert.rejects( palettes.remove( owner, palette.id ), { code: 'serverError' } );
    assert.deepEqual( await palettes.find( owner, palette.id ), palette );
    assert.equal( await quota( owner ), 0 );
    assert.equal( ( await palettes.create( request ) ).created, false );
    await setQuota( owner, 1 );
    assert.equal( await palettes.remove( owner, palette.id ), true );
    assert.equal( await quota( owner ), 0 );
  } );

  test( label + ': stable exclusive pagination with identical millisecond timestamps', async ( context ) => {
    const { palettes, owner, other } = await factory( context );
    const created = await Promise.all( Array.from( { length: 7 }, () => palettes.create( input( owner, { maximum: 20 } ) ) ) );
    await palettes.create( input( other ) );
    assert.equal( new Set( created.map( ( value ) => +value.palette.createdAt ) ).size, 1 );
    const expected = created.map( ( value ) => value.palette.id ).sort().reverse();
    const seen = [];
    let cursor = null;
    do {
      const page = await palettes.list( owner, { cursor, limit: 2 } );
      assert.ok( page.palettes.length > 0 );
      seen.push( ...page.palettes.map( ( value ) => value.id ) );
      cursor = page.continuation;
      if ( cursor ) {
        assert.deepEqual( Object.keys( cursor ).sort(), ['createdAt', 'id'] );
        assert.ok( cursor.createdAt instanceof Date );
        assert.equal( cursor.id, page.palettes.at( -1 ).id );
      }
      assert.ok( seen.length <= expected.length, 'Pagination must terminate without duplicates' );
    } while ( cursor );
    assert.deepEqual( seen, expected );
    assert.deepEqual( await palettes.list( owner, { cursor: { id: expected.at( -1 ), createdAt: created[0].palette.createdAt }, limit: 2 } ),
      { palettes: [], continuation: null } );
  } );
}
