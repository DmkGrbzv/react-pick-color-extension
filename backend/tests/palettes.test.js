import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CloudPaletteService } from '../src/palettes/paletteService.js';
import { normalizeSnapshot, decodeCursor, encodeCursor } from '../src/palettes/paletteValidation.js';

const gradient = {
  type: 'gradient', gradientType: 'linear', direction: 'right',
  stops: [{ hex: '#112233', position: 0 }, { hex: '#FFFFFF', position: 100 }],
};
const snapshot = { name: 'Mixed', items: [{ type: 'color', hex: '#aabbcc' }, gradient] };

test( 'snapshot preserves gradients, order and canonical colors without local IDs', () => {
  const result = normalizeSnapshot( { ...snapshot, items: [...snapshot.items, { type: 'color', hex: '#AABBCC' }] }, 256 );
  assert.deepEqual( result.items, [{ type: 'color', hex: '#AABBCC' }, gradient] );
  for ( const item of result.items ) assert.equal( item.id, undefined );
  assert.deepEqual( snapshot.items[0], { type: 'color', hex: '#aabbcc' } );
} );

test( 'unknown fields, owner spoofing, invalid gradients and oversized or empty sets are rejected', () => {
  for ( const value of [
    { ...snapshot, ownerId: 'another-user' },
    { items: [] }, { items: Array( 257 ).fill( snapshot.items[0] ) },
    { items: [{ type: 'color', hex: 'red' }] },
    { items: [{ ...gradient, css: 'injected' }] },
    { items: [{ ...gradient, stops: [{ hex: '#112233', position: 80 }, { hex: '#FFFFFF', position: 20 }] }] },
    { ...snapshot, name: 'bad\nname' },
  ] ) assert.throws( () => normalizeSnapshot( value, 256 ), { code: 'invalidPalette' } );
} );

test( 'save retries preserve the snapshot, conflict on different content and scope the key to owner', async () => {
  const documents = new Map();
  const repository = {
    async create( { ownerId, key, snapshot, payloadHash } ) {
      const index = ownerId + ':' + key;
      const existing = documents.get( index );
      if ( existing ) return { document: existing, created: false };
      const document = { _id: randomUUID(), ownerId, payloadHash, ...snapshot, createdAt: new Date() };
      documents.set( index, document );
      return { document, created: true };
    },
  };
  const service = new CloudPaletteService( { repository, config: { maxItems: 256, maxPalettes: 100 } } );
  const key = randomUUID();
  const first = await service.save( 'A', snapshot, key );
  const retry = await service.save( 'A', snapshot, key );
  assert.equal( first.created, true );
  assert.equal( retry.created, false );
  assert.equal( retry.palette.id, first.palette.id );
  assert.equal( first.palette.ownerId, undefined );
  await assert.rejects( service.save( 'A', { ...snapshot, name: 'Changed' }, key ), { code: 'saveConflict' } );
  assert.notEqual( ( await service.save( 'B', snapshot, key ) ).palette.id, first.palette.id );
} );

test( 'read and rename always pass owner; missing and foreign palettes have the same error', async () => {
  const repository = {
    find: async ( owner, id ) => owner === 'A' && id === 'own' ? { _id: id, ...snapshot, createdAt: new Date() } : null,
    rename: async ( owner, id, name ) => owner === 'A' && id === 'own' ? { _id: id, ...snapshot, name } : null,
  };
  const service = new CloudPaletteService( { repository, config: {} } );
  assert.equal( ( await service.get( 'A', 'own' ) ).name, 'Mixed' );
  for ( const id of ['own', 'missing'] ) await assert.rejects( service.get( 'B', id ), { status: 404 } );
  await assert.rejects( service.rename( 'B', 'own', { name: 'Changed' } ), { status: 404 } );
  await assert.rejects( service.rename( 'A', 'own', { name: 'Changed', items: [] } ), { status: 400 } );
  assert.equal( ( await service.rename( 'A', 'own', { name: 'Changed' } ) ).name, 'Changed' );
} );

test( 'pagination validates limits and cursors and retains the tie-breaking ID', async () => {
  const document = { _id: randomUUID(), createdAt: new Date() };
  const cursor = decodeCursor( encodeCursor( document ) );
  assert.deepEqual( cursor, { date: document.createdAt, id: document._id } );
  assert.throws( () => decodeCursor( 'invalid' ), { code: 'invalidCursor' } );
  const service = new CloudPaletteService( { repository: { list: async ( owner, page ) => ( { owner, ...page } ) }, config: {} } );
  for ( const limit of ['0', '51', 'invalid'] ) assert.throws( () => service.list( 'A', { limit } ), { status: 400 } );
  assert.equal( ( await service.list( 'A', { limit: '20' } ) ).limit, 20 );
} );

test( 'deletion scopes by owner and a deleted save receipt cannot resurrect the snapshot', async () => {
  const calls = [];
  const service = new CloudPaletteService( {
    config: { maxItems: 256, maxPalettes: 100 },
    repository: {
      remove: async ( owner, id ) => { calls.push( [owner, id] ); return owner === 'A' && id === 'own'; },
      create: async () => ( { document: { deletedAt: new Date() }, created: false } ),
    },
  } );
  await service.remove( 'A', 'own' );
  assert.deepEqual( calls[0], ['A', 'own'] );
  await assert.rejects( service.remove( 'B', 'own' ), { status: 404, code: 'notFound' } );
  await assert.rejects( service.remove( 'A', 'missing' ), { status: 404, code: 'notFound' } );
  await assert.rejects( service.save( 'A', snapshot, randomUUID() ), { status: 410, code: 'snapshotDeleted' } );
} );
