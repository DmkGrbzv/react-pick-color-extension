export async function createIndexes( db ) {
  await Promise.all( [
    db.collection( 'users' ).createIndex( { provider: 1, sub: 1 }, { unique: true } ),
    db.collection( 'palettes' ).createIndex( { ownerId: 1, key: 1 }, { unique: true } ),
    db.collection( 'palettes' ).createIndex( { ownerId: 1, createdAt: -1, _id: -1 } ),
    db.collection( 'sessions' ).createIndex( { tokenHash: 1 }, { unique: true } ),
    db.collection( 'sessions' ).createIndex( { expiresAt: 1 }, { expireAfterSeconds: 0 } ),
    db.collection( 'authTransactions' ).createIndex( { state: 1 }, { unique: true } ),
    db.collection( 'authExchanges' ).createIndex( { codeHash: 1 }, { unique: true } ),
    ...['authTransactions', 'authExchanges', 'rateLimits'].map( ( name ) =>
      db.collection( name ).createIndex( { expiresAt: 1 }, { expireAfterSeconds: 0 } ) ),
  ] );
}
