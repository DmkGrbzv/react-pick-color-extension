import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../src/errors/applicationError.js';

/** @implements {import('../../src/contracts/authRepository.js').AuthRepository} */
export class AuthMemoryRepository {
  transactions = new Map();
  exchanges = new Map();
  sessions = new Map();
  users = new Map();
  #insert( records, key, value ) {
    if ( records.has( key ) ) throw new ApplicationError( 'operationConflict' );
    const entity = { ...structuredClone( value ), id: randomUUID() };
    records.set( key, entity );
    return structuredClone( entity );
  }
  async createTransaction( value ) { return this.#insert( this.transactions, value.state, value ); }
  async takeTransaction( state ) {
    const value = this.transactions.get( state );
    if ( !value || value.expiresAt <= new Date() ) return null;
    this.transactions.delete( state );
    return structuredClone( value );
  }
  async createExchange( value ) { return this.#insert( this.exchanges, value.codeHash, value ); }
  async takeExchange( hash, challenge ) {
    const value = this.exchanges.get( hash );
    if ( !value || value.challenge !== challenge || value.expiresAt <= new Date() ) return null;
    this.exchanges.delete( hash );
    return structuredClone( value );
  }
  async findUser( identity ) {
    const key = identity.provider + ':' + identity.sub;
    const user = { id: key, provider: identity.provider, sub: identity.sub, email: identity.email ?? null };
    this.users.set( key, user );
    return structuredClone( user );
  }
  async createSession( value ) { return this.#insert( this.sessions, value.tokenHash, value ); }
  async findSession( hash ) {
    const value = this.sessions.get( hash );
    if ( !value || value.expiresAt <= new Date() ) return null;
    const user = [...this.users.values()].find( ( user ) => user.id === value.userId );
    return user ? structuredClone( { ...value, user } ) : null;
  }
  async revokeSession( hash ) { return this.sessions.delete( hash ); }
}
