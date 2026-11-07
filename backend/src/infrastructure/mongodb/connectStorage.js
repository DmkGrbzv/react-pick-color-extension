import { MongoClient } from 'mongodb';
import { AuthRepository } from './authRepository.js';
import { CloudPaletteRepository } from './paletteRepository.js';
import { RateLimiter } from './rateLimiter.js';
import { createIndexes } from './indexes.js';

export async function connectMongoStorage( config ) {
  const client = new MongoClient( config.uri, { serverSelectionTimeoutMS: 10_000 } );
  try {
    await client.connect();
    const db = client.db( config.database );
    await createIndexes( db );
    let closed = false;
    return {
      authRepository: new AuthRepository( db ),
      paletteRepository: new CloudPaletteRepository( { db, client } ),
      limiter: new RateLimiter( db ),
      async isReady() {
        if ( closed ) return false;
        try {
          // Driver 7.8 makes timeoutMS a no-op. Db.command forwards the abort signal;
          // Admin.command currently drops it. Bound both server selection and I/O.
          const hello = await client.db( 'admin' ).command( { hello: 1 }, { signal: AbortSignal.timeout( 1500 ) } );
          return hello.isWritablePrimary === true;
        } catch { return false; }
      },
      close: () => { closed = true; return client.close(); },
    };
  } catch ( error ) {
    await client.close();
    throw error;
  }
}
