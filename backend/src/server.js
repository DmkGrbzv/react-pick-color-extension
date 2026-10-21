import process from 'node:process';
import { once } from 'node:events';
import { MongoClient } from 'mongodb';
import { readConfig } from './config.js';
import { createApp } from './app.js';
import { createIndexes } from './database/indexes.js';
import { AuthRepository } from './auth/authRepository.js';
import { AuthService } from './auth/authService.js';
import { createIdentityProvider } from './auth/oidcProvider.js';
import { CloudPaletteRepository } from './palettes/paletteRepository.js';
import { SavedPaletteService } from './palettes/paletteService.js';
import { RateLimiter } from './http/rateLimit.js';

function registerShutdown( server, client ) {
  let closing = false;
  const shutdown = () => {
    if ( closing ) return;
    closing = true;
    server.close( async () => {
      await client.close();
      process.exit( 0 );
    } );
    setTimeout( () => process.exit( 1 ), 10_000 ).unref();
  };
  process.on( 'SIGTERM', shutdown );
  process.on( 'SIGINT', shutdown );
}

async function start() {
  const config = readConfig( process.env );
  let client;
  try {
    client = new MongoClient( config.mongoUri, { serverSelectionTimeoutMS: 10_000 } );
    await client.connect();
    const db = client.db( config.database );
    await createIndexes( db );
    const auth = new AuthService( {
      repository: new AuthRepository( db ), provider: await createIdentityProvider( config ), config,
    } );
    const palettes = new SavedPaletteService( {
      repository: new CloudPaletteRepository( { db, client } ), config,
    } );
    const app = createApp( { config, auth, palettes, limiter: new RateLimiter( db ) } );
    const server = app.listen( config.port );
    await once( server, 'listening' );
    registerShutdown( server, client );
    console.log( 'Palette API listening on port ' + config.port );
  } catch {
    await client?.close();
    throw new Error( 'API startup failed. Check database availability and OIDC configuration.' );
  }
}

try {
  await start();
} catch ( error ) {
  // Connection/provider errors are sanitized before reaching this boundary.
  console.error( error.message );
  process.exitCode = 1;
}
