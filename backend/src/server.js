import process from 'node:process';
import { once } from 'node:events';
import { readConfig } from './config.js';
import { createApp } from './app.js';
import { readMongoConfig } from './infrastructure/mongodb/config.js';
import { connectMongoStorage } from './infrastructure/mongodb/connectStorage.js';
import { AuthService } from './auth/authService.js';
import { createIdentityProvider } from './infrastructure/oidc/oidcProvider.js';
import { SavedPaletteService } from './palettes/paletteService.js';

function registerShutdown( server, storage ) {
  let closing = false;
  const shutdown = () => {
    if ( closing ) return;
    closing = true;
    server.close( async () => {
      await storage.close();
      process.exit( 0 );
    } );
    setTimeout( () => process.exit( 1 ), 10_000 ).unref();
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
    const app = createApp( { config, auth, palettes, limiter: storage.limiter } );
    const server = app.listen( config.port );
    await once( server, 'listening' );
    registerShutdown( server, storage );
    console.log( 'Palette API listening on port ' + config.port );
  } catch {
    await storage?.close();
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
