export class AuthMemoryRepository {
  transactions = new Map();
  exchanges = new Map();
  sessions = new Map();
  users = new Map();
  async createTransaction( value ) { this.transactions.set( value.state, structuredClone( value ) ); }
  async takeTransaction( state ) {
    const value = this.transactions.get( state );
    if ( !value || value.expiresAt <= new Date() ) return null;
    this.transactions.delete( state );
    return value;
  }
  async createExchange( value ) { this.exchanges.set( value.codeHash, structuredClone( value ) ); }
  async takeExchange( hash, challenge ) {
    const value = this.exchanges.get( hash );
    if ( !value || value.challenge !== challenge || value.expiresAt <= new Date() ) return null;
    this.exchanges.delete( hash );
    return value;
  }
  async findUser( identity ) {
    const key = identity.provider + ':' + identity.sub;
    if ( !this.users.has( key ) ) this.users.set( key, { _id: key, ...identity } );
    return this.users.get( key );
  }
  async createSession( value ) { this.sessions.set( value.tokenHash, structuredClone( value ) ); }
  async findSession( hash ) {
    const value = this.sessions.get( hash );
    if ( !value || value.expiresAt <= new Date() ) return null;
    const user = [...this.users.values()].find( ( user ) => user._id === value.userId );
    return { ...value, user };
  }
  async revokeSession( hash ) { this.sessions.delete( hash ); }
}
