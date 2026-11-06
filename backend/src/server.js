import process from 'node:process';
import { once } from 'node:events';
import { readConfig } from './config.js';
import { createApp } from './app.js';
import { readMongoConfig } from './infrastructure/mongodb/config.js';
import { connectMongoStorage } from './infrastructure/mongodb/connectStorage.js';
import { AuthService } from './auth/authService.js';
import { createIdentityProvider } from './infrastructure/oidc/oidcProvider.js';
import { SavedPaletteService } from './palettes/paletteService.js';

function registerShutdown( server, storage, state ) {
  let closing = false;
  const shutdown = () => {
    if ( closing ) return;
    closing = true;
    state.draining = true;
    const timeout = setTimeout( () => process.exit( 1 ), 10_000 );
    timeout.unref();
    server.close( async () => {
      try {
        await storage.close();
        clearTimeout( timeout );
        process.exitCode = 0;
      } catch {
        console.error( 'API shutdown failed while closing storage.' );
        process.exitCode = 1;
      }
    } );
  };
  process.on( 'SIGTERM', shutdown );
  process.on( 'SIGINT', shutdown );
}

async function start() {
  const config = readConfig( process.env );
  const storageConfig = readMongoConfig( process.env );
  let storage;
  try {
    storage = await connectMongoStorage( storageConfig );
    const auth = new AuthService( {
      repository: storage.authRepository, provider: await createIdentityProvider( config ), config,
    } );
    const palettes = new SavedPaletteService( {
      repository: storage.paletteRepository, config,
    } );
    const state = { draining: false };
    const app = createApp( { config, auth, palettes, limiter: storage.limiter,
      readiness: async () => !state.draining && await storage.isReady() && !state.draining } );
    const server = app.listen( config.port );
    await once( server, 'listening' );
    registerShutdown( server, storage, state );
    console.log( 'Palette API listening on port ' + config.port );
  } catch {
    try { await storage?.close(); } catch { /* Startup failures stay sanitized. */ }
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
