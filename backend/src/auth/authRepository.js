import { randomUUID } from 'node:crypto';

export class AuthRepository {
  #db;
  constructor( db ) {
    this.#db = db;
  }
  createTransaction( value ) {
    return this.#db.collection( 'authTransactions' ).insertOne( value );
  }
  takeTransaction( state ) {
    return this.#db.collection( 'authTransactions' ).findOneAndDelete( {
      state, expiresAt: { $gt: new Date() },
    } );
  }
  createExchange( value ) {
    return this.#db.collection( 'authExchanges' ).insertOne( value );
  }
  takeExchange( codeHash, challenge ) {
    return this.#db.collection( 'authExchanges' ).findOneAndDelete( {
      codeHash, challenge, expiresAt: { $gt: new Date() },
    } );
  }
  async findUser( identity ) {
    const users = this.#db.collection( 'users' );
    const filter = { provider: identity.provider, sub: identity.sub };
    try {
      return await users.findOneAndUpdate( filter, {
        $setOnInsert: { _id: randomUUID(), ...filter, paletteCount: 0 },
        $set: { email: identity.email ?? null },
      }, { upsert: true, returnDocument: 'after' } );
    } catch ( error ) {
      if ( error.code !== 11000 ) throw error;
      return users.findOne( filter );
    }
  }
  createSession( value ) {
    return this.#db.collection( 'sessions' ).insertOne( value );
  }
  async findSession( tokenHash ) {
    const session = await this.#db.collection( 'sessions' ).findOne( {
      tokenHash, expiresAt: { $gt: new Date() },
    } );
    if ( !session ) return null;
    const user = await this.#db.collection( 'users' ).findOne( { _id: session.userId } );
    return user ? { ...session, user } : null;
  }
  revokeSession( tokenHash ) {
    return this.#db.collection( 'sessions' ).deleteOne( { tokenHash } );
  }
}
