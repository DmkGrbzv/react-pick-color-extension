import { randomUUID } from 'node:crypto';
import { ApiError } from '../http/apiError.js';
import { encodeCursor, publicPalette } from './paletteValidation.js';

export class CloudPaletteRepository {
  #db;
  #client;
  constructor( { db, client } ) {
    this.#db = db;
    this.#client = client;
  }

  findSave( ownerId, key, session ) {
    return this.#db.collection( 'palettes' ).findOne( { ownerId, key }, { session } );
  }

  async create( { ownerId, key, snapshot, payloadHash, maximum } ) {
    const session = this.#client.startSession();
    try {
      return await session.withTransaction( () => this.#insert( {
        ownerId, key, snapshot, payloadHash, maximum, session,
      } ), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } } );
    } catch ( error ) {
      if ( error.code !== 11000 ) throw error;
      const existing = await this.findSave( ownerId, key );
      if ( !existing ) throw error;
      return { document: existing, created: false };
    } finally {
      await session.endSession();
    }
  }

  async #insert( { ownerId, key, snapshot, payloadHash, maximum, session } ) {
    const existing = await this.findSave( ownerId, key, session );
    if ( existing ) return { document: existing, created: false };
    const result = await this.#db.collection( 'users' ).updateOne( {
      _id: ownerId, paletteCount: { $lt: maximum },
    }, { $inc: { paletteCount: 1 } }, { session } );
    if ( result.modifiedCount !== 1 ) throw new ApiError( 409, 'paletteLimit' );
    const document = {
      _id: randomUUID(), ownerId, key, payloadHash, ...snapshot, createdAt: new Date(),
    };
    await this.#db.collection( 'palettes' ).insertOne( document, { session } );
    return { document, created: true };
  }

  async list( ownerId, { cursor, limit } ) {
    const filter = { ownerId, deletedAt: { $exists: false } };
    if ( cursor ) filter.$or = [
      { createdAt: { $lt: cursor.date } },
      { createdAt: cursor.date, _id: { $lt: cursor.id } },
    ];
    const documents = await this.#db.collection( 'palettes' ).find( filter )
      .sort( { createdAt: -1, _id: -1 } ).limit( limit + 1 ).toArray();
    const page = documents.slice( 0, limit );
    return {
      palettes: page.map( publicPalette ),
      nextCursor: documents.length > limit ? encodeCursor( page.at( -1 ) ) : null,
    };
  }

  find( ownerId, id ) {
    return this.#db.collection( 'palettes' ).findOne( { _id: id, ownerId, deletedAt: { $exists: false } } );
  }

  rename( ownerId, id, name ) {
    return this.#db.collection( 'palettes' ).findOneAndUpdate( { _id: id, ownerId, deletedAt: { $exists: false } }, {
      $set: { name },
    }, { returnDocument: 'after' } );
  }

  async remove( ownerId, id ) {
    const session = this.#client.startSession();
    try {
      return await session.withTransaction( () => this.#removeSnapshot( ownerId, id, session ), {
        readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
      } );
    } finally {
      await session.endSession();
    }
  }

  async #removeSnapshot( ownerId, id, session ) {
    const palettes = this.#db.collection( 'palettes' );
    const existing = await palettes.findOne( { _id: id, ownerId }, { session } );
    if ( !existing ) return false;
    if ( existing.deletedAt ) return true;
    // Keep the save receipt so a delayed POST retry cannot recreate a deleted set.
    await palettes.updateOne( { _id: id, ownerId }, {
      $set: { deletedAt: new Date() }, $unset: { items: '', name: '' },
    }, { session } );
    const quota = await this.#db.collection( 'users' ).updateOne( {
      _id: ownerId, paletteCount: { $gt: 0 },
    }, { $inc: { paletteCount: -1 } }, { session } );
    if ( quota.modifiedCount !== 1 ) throw new ApiError( 500, 'serverError' );
    return true;
  }
}
