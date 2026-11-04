import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../errors/applicationError.js';

function entity( document ) {
  if ( !document ) return null;
  const { _id, ...value } = document;
  return { id: String( _id ), ...value };
}
function userEntity( document ) {
  return document ? { id: String( document._id ), provider: document.provider,
    sub: document.sub, email: document.email ?? null } : null;
}

/** @implements {import('../../contracts/authRepository.js').AuthRepository} */
export class AuthRepository {
  #db;
  constructor( db ) { this.#db = db; }
  async #insert( collection, value ) {
    const document = { ...structuredClone( value ), _id: randomUUID() };
    try { await this.#db.collection( collection ).insertOne( document ); }
    catch ( error ) {
      if ( error.code === 11000 ) throw new ApplicationError( 'operationConflict' );
      throw error;
    }
    return entity( document );
  }
  createTransaction( value ) { return this.#insert( 'authTransactions', value ); }
  async takeTransaction( state ) {
    return entity( await this.#db.collection( 'authTransactions' ).findOneAndDelete( {
      state, expiresAt: { $gt: new Date() },
    } ) );
  }
  createExchange( value ) { return this.#insert( 'authExchanges', value ); }
  async takeExchange( codeHash, challenge ) {
    return entity( await this.#db.collection( 'authExchanges' ).findOneAndDelete( {
      codeHash, challenge, expiresAt: { $gt: new Date() },
    } ) );
  }
  async findUser( identity ) {
    const users = this.#db.collection( 'users' );
    const filter = { provider: identity.provider, sub: identity.sub };
    try {
      return userEntity( await users.findOneAndUpdate( filter, {
        $setOnInsert: { _id: randomUUID(), ...filter, paletteCount: 0 },
        $set: { email: identity.email ?? null },
      }, { upsert: true, returnDocument: 'after' } ) );
    } catch ( error ) {
      if ( error.code !== 11000 ) throw error;
      return userEntity( await users.findOne( filter ) );
    }
  }
  createSession( value ) { return this.#insert( 'sessions', value ); }
  async findSession( tokenHash ) {
    const session = await this.#db.collection( 'sessions' ).findOne( {
      tokenHash, expiresAt: { $gt: new Date() },
    } );
    if ( !session ) return null;
    const user = userEntity( await this.#db.collection( 'users' ).findOne( { _id: session.userId } ) );
    return user ? { ...entity( session ), user } : null;
  }
  async revokeSession( tokenHash ) {
    return ( await this.#db.collection( 'sessions' ).deleteOne( { tokenHash } ) ).deletedCount === 1;
  }
}
