import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createIndexes } from '../src/database/indexes.js';
import { CloudPaletteRepository } from '../src/palettes/paletteRepository.js';
import { SavedPaletteService } from '../src/palettes/paletteService.js';

// Explicit opt-in URI. Every test uses and drops only its own generated database.
test( 'MongoDB enforces concurrent save uniqueness, ownership, quota and cursor pagination', async () => {
  assert.ok( process.env.MONGODB_TEST_URI, 'Set MONGODB_TEST_URI to a disposable replica set' );
  const client = new MongoClient( process.env.MONGODB_TEST_URI, { serverSelectionTimeoutMS: 5000 } );
  await client.connect();
  const db = client.db( 'palette_test_' + randomUUID().replaceAll( '-', '' ) );
  try {
    await createIndexes( db );
    await db.collection( 'users' ).insertOne( { _id: 'A', paletteCount: 0 } );
    const service = new SavedPaletteService( {
      repository: new CloudPaletteRepository( { db, client } ), config: { maxItems: 256, maxPalettes: 3 },
    } );
    const snapshot = { items: [{ type: 'color', hex: '#AABBCC' }] };
    const key = randomUUID();
    const results = await Promise.all( Array.from( { length: 5 }, () => service.save( 'A', snapshot, key ) ) );
    assert.equal( new Set( results.map( ( result ) => result.palette.id ) ).size, 1 );
    assert.equal( await db.collection( 'palettes' ).countDocuments(), 1 );
    await assert.rejects( service.get( 'B', results[0].palette.id ), { status: 404 } );
    const saves = await Promise.allSettled( Array.from( { length: 5 }, () => service.save( 'A', snapshot, randomUUID() ) ) );
    assert.equal( saves.filter( ( result ) => result.status === 'fulfilled' ).length, 2 );
    assert.equal( await db.collection( 'palettes' ).countDocuments(), 3 );
    const first = await service.list( 'A', { limit: 2 } );
    const second = await service.list( 'A', { limit: 2, cursor: first.nextCursor } );
    assert.equal( first.palettes.length, 2 );
    assert.equal( second.palettes.length, 1 );
    assert.equal( new Set( [...first.palettes, ...second.palettes].map( ( item ) => item.id ) ).size, 3 );
    const id = results[0].palette.id;
    await assert.rejects( service.remove( 'B', id ), { status: 404 } );
    await Promise.all( Array.from( { length: 3 }, () => service.remove( 'A', id ) ) );
    assert.equal( ( await db.collection( 'users' ).findOne( { _id: 'A' } ) ).paletteCount, 2 );
    assert.equal( ( await service.list( 'A', {} ) ).palettes.length, 2 );
    await assert.rejects( service.get( 'A', id ), { status: 404 } );
    await assert.rejects( service.rename( 'A', id, { name: 'Restore' } ), { status: 404 } );
    await assert.rejects( service.save( 'A', snapshot, key ), { status: 410 } );
    const receipt = await db.collection( 'palettes' ).findOne( { _id: id } );
    assert.equal( receipt.items, undefined );
    assert.equal( receipt.name, undefined );
    await service.save( 'A', snapshot, randomUUID() );
    assert.equal( ( await db.collection( 'users' ).findOne( { _id: 'A' } ) ).paletteCount, 3 );
  } finally {
    await db.dropDatabase();
    await client.close();
  }
} );
