import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createIndexes } from '../src/infrastructure/mongodb/indexes.js';
import { AuthRepository } from '../src/infrastructure/mongodb/authRepository.js';
import { CloudPaletteRepository } from '../src/infrastructure/mongodb/paletteRepository.js';
import { RateLimiter } from '../src/infrastructure/mongodb/rateLimiter.js';
import { connectMongoStorage } from '../src/infrastructure/mongodb/connectStorage.js';
import { authRepositoryContract } from './contracts/authRepository.js';
import { paletteRepositoryContract } from './contracts/paletteRepository.js';

// Each test owns a generated database; application databases are never cleared.
async function mongoFactory( context ) {
  assert.ok( process.env.MONGODB_TEST_URI, 'Set MONGODB_TEST_URI to a disposable replica set' );
  const client = new MongoClient( process.env.MONGODB_TEST_URI, { serverSelectionTimeoutMS: 5000 } );
  const db = client.db( 'palette_test_' + randomUUID().replaceAll( '-', '' ) );
  context.after( async () => { try { await db.dropDatabase(); } finally { await client.close(); } } );
  await client.connect();
  assert.ok( ( await db.admin().command( { hello: 1 } ) ).setName, 'Transactions require a real replica set' );
  await createIndexes( db );
  const auth = new AuthRepository( db );
  const owner = await auth.findUser( { provider: 'fixture', sub: 'A' } );
  const other = await auth.findUser( { provider: 'fixture', sub: 'B' } );
  const palettes = new CloudPaletteRepository( { db, client, now: () => new Date( '2026-01-01T00:00:00.123Z' ) } );
  return { db, auth, palettes, owner: owner.id, other: other.id,
    quota: async ( id ) => ( await db.collection( 'users' ).findOne( { _id: id } ) ).paletteCount,
    setQuota: ( id, value ) => db.collection( 'users' ).updateOne( { _id: id }, { $set: { paletteCount: value } } ) };
}

authRepositoryContract( 'Mongo auth', mongoFactory );
paletteRepositoryContract( 'Mongo palettes', mongoFactory );

test( 'Mongo storage readiness requires a writable primary and becomes false after close', async ( context ) => {
  const { db } = await mongoFactory( context );
  const storage = await connectMongoStorage( { uri: process.env.MONGODB_TEST_URI, database: db.databaseName } );
  context.after( () => storage.close() );
  assert.equal( await storage.isReady(), true );
  await storage.close();
  assert.equal( await storage.isReady(), false );
} );

test( 'Mongo: legacy ObjectId auth records, UUID users and tombstones remain compatible', async ( context ) => {
  const { db, auth, palettes, owner } = await mongoFactory( context );
  const expiresAt = new Date( Date.now() + 60_000 );
  const transactionId = new ObjectId();
  await db.collection( 'authTransactions' ).insertOne( { _id: transactionId, state: 'legacy', expiresAt } );
  assert.equal( ( await auth.takeTransaction( 'legacy' ) ).id, transactionId.toHexString() );
  const exchangeId = new ObjectId();
  await db.collection( 'authExchanges' ).insertOne( {
    _id: exchangeId, codeHash: 'legacy', challenge: 'challenge', userId: owner, email: null, expiresAt,
  } );
  assert.equal( ( await auth.takeExchange( 'legacy', 'challenge' ) ).id, exchangeId.toHexString() );
  const sessionId = new ObjectId();
  await db.collection( 'sessions' ).insertOne( { _id: sessionId, tokenHash: 'legacy', userId: owner, expiresAt } );
  assert.equal( ( await auth.findSession( 'legacy' ) ).id, sessionId.toHexString() );
  const id = randomUUID();
  await db.collection( 'palettes' ).insertOne( { _id: id, ownerId: owner, key: 'legacy', payloadHash: 'hash',
    name: 'Legacy', items: [{ type: 'color', hex: '#AABBCC' }], createdAt: new Date( '2026-01-01T00:00:00.123Z' ) } );
  await db.collection( 'users' ).updateOne( { _id: owner }, { $set: { paletteCount: 1 } } );
  assert.equal( ( await palettes.find( owner, id ) ).name, 'Legacy' );
  await palettes.remove( owner, id );
  const receipt = await db.collection( 'palettes' ).findOne( { _id: id } );
  assert.equal( receipt.items, undefined );
  assert.equal( receipt.name, undefined );
  assert.ok( receipt.deletedAt instanceof Date );
  await assert.rejects( palettes.create( { ownerId: owner, key: 'legacy', payloadHash: 'hash', snapshot: {}, maximum: 3 } ),
    { code: 'snapshotDeleted' } );
} );

test( 'Mongo rate limiter: concurrent counting, scope isolation and neutral rejection', async ( context ) => {
  const { db } = await mongoFactory( context );
  const limiter = new RateLimiter( db );
  const results = await Promise.allSettled( Array.from( { length: 8 }, () => limiter.check( 'test', 'identity', 3 ) ) );
  assert.equal( results.filter( ( result ) => result.status === 'fulfilled' ).length, 3 );
  for ( const failure of results.filter( ( result ) => result.status === 'rejected' ) ) {
    assert.equal( failure.reason.code, 'rateLimited' );
    assert.equal( failure.reason.status, undefined );
  }
  await limiter.check( 'other', 'identity', 3 );
  await limiter.check( 'test', 'other', 3 );
} );
