import { MongoClient } from 'mongodb';
import { setServers } from 'node:dns';
import { isIP } from 'node:net';
import { readMongoConfig } from '../src/infrastructure/mongodb/config.js';
import { atlasConnectionError } from './atlasConnectionError.js';

async function checkAtlasConnection() {
  const config = readMongoConfig( process.env );
  const target = new URL( config.uri );
  if ( target.protocol !== 'mongodb+srv:' || target.hostname !== 'palette-staging.kyvrc93.mongodb.net' ||
    target.username !== 'palette_staging_app' || target.pathname !== '/palette_staging' ||
    config.database !== 'palette_staging' || target.searchParams.get( 'authSource' ) !== 'admin' ) {
    console.error( 'Atlas check refused: use the configured staging host, user and palette_staging database.' );
    process.exitCode = 1;
    return;
  }
  if ( !target.password || decodeURIComponent( target.password ) === '<PASSWORD>' ) {
    console.error( 'Insert the Atlas password in backend/.env.staging.local before running this check.' );
    process.exitCode = 1;
    return;
  }
  if ( process.env.ATLAS_DNS_SERVERS?.trim() ) {
    const servers = process.env.ATLAS_DNS_SERVERS.split( ',' ).map( ( server ) => server.trim() );
    if ( servers.some( ( server ) => !isIP( server ) ) ) {
      console.error( 'Atlas check refused: ATLAS_DNS_SERVERS must contain comma-separated DNS server IP addresses.' );
      process.exitCode = 1;
      return;
    }
    // This override lasts only for this standalone probe process.
    setServers( servers );
  }
  const client = new MongoClient( config.uri, {
    tls: true, serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000,
    socketTimeoutMS: 10_000, retryReads: false,
    mongodbLogComponentSeverities: { default: 'off', command: 'off', topology: 'off',
      serverSelection: 'off', connection: 'off', client: 'off' },
  } );
  try {
    await client.connect();
    const result = await client.db( config.database ).command( { ping: 1 }, { signal: AbortSignal.timeout( 10_000 ) } );
    if ( result.ok !== 1 ) throw new Error( 'Ping failed' );
  } finally {
    await client.close();
  }
  console.log( 'Atlas staging ping succeeded (palette_staging); connection closed.' );
}

checkAtlasConnection().catch( ( error ) => {
  console.error( 'Atlas staging check failed ' + atlasConnectionError( error ) );
  process.exitCode = 1;
} );
