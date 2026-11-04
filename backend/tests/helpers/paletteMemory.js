import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../src/errors/applicationError.js';

/** @implements {import('../../src/contracts/paletteRepository.js').PaletteRepository} */
export class PaletteMemoryRepository {
  records = new Map();
  quotas = new Map();
  #now;
  constructor( now = () => new Date() ) { this.#now = now; }
  #entity( record ) {
    if ( !record || record.deleted ) return null;
    const { id, ownerId, name, items, createdAt } = record;
    return structuredClone( { id, ownerId, name, items, createdAt } );
  }
  async create( { ownerId, key, snapshot, payloadHash, maximum } ) {
    // Synchronous critical section: no await between checking and committing.
    const existing = [...this.records.values()].find( ( item ) => item.ownerId === ownerId && item.key === key );
    if ( existing?.deleted ) throw new ApplicationError( 'snapshotDeleted' );
    if ( existing && existing.payloadHash !== payloadHash ) throw new ApplicationError( 'saveConflict' );
    if ( existing ) return { palette: this.#entity( existing ), created: false };
    const quota = this.quotas.get( ownerId );
    if ( quota === undefined || quota >= maximum ) throw new ApplicationError( 'paletteLimit' );
    const record = { ...structuredClone( snapshot ), id: randomUUID(), ownerId, key, payloadHash, createdAt: this.#now() };
    this.records.set( record.id, record );
    this.quotas.set( ownerId, quota + 1 );
    return { palette: this.#entity( record ), created: true };
  }
  async list( ownerId, { cursor, limit } ) {
    const records = [...this.records.values()].filter( ( item ) => item.ownerId === ownerId && !item.deleted )
      .filter( ( item ) => !cursor || item.createdAt < cursor.createdAt ||
        +item.createdAt === +cursor.createdAt && item.id < cursor.id )
      .sort( ( a, b ) => b.createdAt - a.createdAt || ( a.id < b.id ? 1 : a.id > b.id ? -1 : 0 ) );
    const page = records.slice( 0, limit );
    const last = page.at( -1 );
    return { palettes: page.map( ( item ) => this.#entity( item ) ),
      continuation: records.length > limit ? structuredClone( { createdAt: last.createdAt, id: last.id } ) : null };
  }
  async find( ownerId, id ) {
    const record = this.records.get( id );
    return record?.ownerId === ownerId ? this.#entity( record ) : null;
  }
  async rename( ownerId, id, name ) {
    const record = this.records.get( id );
    if ( !record || record.ownerId !== ownerId || record.deleted ) return null;
    record.name = name;
    return this.#entity( record );
  }
  async remove( ownerId, id ) {
    const record = this.records.get( id );
    if ( !record || record.ownerId !== ownerId ) return false;
    if ( record.deleted ) return true;
    const quota = this.quotas.get( ownerId );
    if ( !( quota > 0 ) ) throw new ApplicationError( 'serverError' );
    record.deleted = true;
    delete record.name;
    delete record.items;
    this.quotas.set( ownerId, quota - 1 );
    return true;
  }
}
