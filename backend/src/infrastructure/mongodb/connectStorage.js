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
    return {
      authRepository: new AuthRepository( db ),
      paletteRepository: new CloudPaletteRepository( { db, client } ),
      limiter: new RateLimiter( db ),
      close: () => client.close(),
    };
  } catch ( error ) {
    await client.close();
    throw error;
  }
}
