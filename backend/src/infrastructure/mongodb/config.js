export function readMongoConfig( env ) {
  const uri = env.MONGODB_URI?.trim();
  const database = env.MONGODB_DATABASE?.trim();
  if ( !uri ) throw new Error( 'Missing configuration: MONGODB_URI' );
  if ( !database ) throw new Error( 'Missing configuration: MONGODB_DATABASE' );
  const encrypted = uri.startsWith( 'mongodb+srv://' ) || /[?&](tls|ssl)=true(&|$)/i.test( uri );
  if ( env.NODE_ENV !== 'development' && ( !encrypted || /[?&](tls|ssl)=false(&|$)/i.test( uri ) ) ) {
    throw new Error( 'Production MongoDB requires TLS' );
  }
  return { uri, database };
}
