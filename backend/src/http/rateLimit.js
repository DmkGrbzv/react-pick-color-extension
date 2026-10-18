import { ApiError } from './apiError.js';
import { digest } from '../auth/crypto.js';

export class RateLimiter {
  #collection;
  constructor( db ) {
    this.#collection = db.collection( 'rateLimits' );
  }
  async check( scope, identity, maximum ) {
    const minute = Math.floor( Date.now() / 60_000 );
    const _id = scope + ':' + digest( identity ) + ':' + minute;
    const update = {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date( ( minute + 2 ) * 60_000 ) },
    };
    let result;
    try {
      result = await this.#collection.findOneAndUpdate( { _id }, update,
        { upsert: true, returnDocument: 'after' } );
    } catch ( error ) {
      if ( error.code !== 11000 ) throw error;
      result = await this.#collection.findOneAndUpdate( { _id }, update, { returnDocument: 'after' } );
    }
    if ( result.count > maximum ) throw new ApiError( 429, 'rateLimited' );
  }
}
