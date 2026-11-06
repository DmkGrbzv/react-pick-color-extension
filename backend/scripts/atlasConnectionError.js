function connectionErrors( error ) {
  const pending = [error];
  const seen = new Set();
  while ( pending.length && seen.size < 16 ) {
    const current = pending.shift();
    if ( !current || typeof current !== 'object' || seen.has( current ) ) continue;
    seen.add( current );
    if ( current.cause ) pending.push( current.cause );
    if ( current.reason?.servers instanceof Map ) {
      for ( const server of current.reason.servers.values() ) pending.push( server.error );
    }
  }
  return [...seen];
}

// Return fixed messages only. Never interpolate driver messages, codes or hosts.
export function atlasConnectionError( error ) {
  const errors = connectionErrors( error );
  const codes = new Set( errors.map( ( item ) => item.code ) );
  if ( codes.has( 18 ) || errors.some( ( item ) => item.codeName === 'AuthenticationFailed' ||
    item.code === 8000 && /bad auth|authentication failed/i.test( item.message || '' ) ) ) {
    return '[AUTH] Authentication failed. Check the database password and its URI encoding.';
  }
  if ( codes.has( 13 ) ) return '[PERMISSIONS] The database user is not permitted to run this command.';
  if ( ['ENOTFOUND', 'ENODATA', 'ETIMEOUT', 'EAI_AGAIN', 'ESERVFAIL', 'EBADRESP'].some( ( code ) => codes.has( code ) ) ||
    errors.some( ( item ) => item.code === 'ECONNREFUSED' && ['querySrv', 'queryTxt'].includes( item.syscall ) ) ) {
    return '[DNS] Atlas DNS lookup failed. Check your DNS resolver or set ATLAS_DNS_SERVERS for this probe.';
  }
  if ( errors.some( ( item ) => typeof item.code === 'string' && /^ERR_TLS_|^ERR_SSL_|CERT_|^UNABLE_TO_/.test( item.code ) ) ) {
    return '[TLS] Secure connection failed. Check certificates, the system clock and VPN or antivirus TLS interception.';
  }
  if ( ['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPERM', 'EACCES'].some( ( code ) => codes.has( code ) ) ) {
    return '[NETWORK] Connection failed. Check Atlas Network Access, your current public IP and firewall or VPN.';
  }
  if ( codes.has( 'ETIMEDOUT' ) || errors.some( ( item ) => ['MongoServerSelectionError', 'MongoNetworkTimeoutError', 'TimeoutError'].includes( item.name ) ) ) {
    return '[TIMEOUT] Atlas did not become reachable. Check cluster availability, Network Access and firewall or VPN.';
  }
  if ( codes.has( 'ERR_INVALID_URL' ) || errors.some( ( item ) => ['MongoParseError', 'MongoInvalidArgumentError', 'URIError'].includes( item.name ) ) ) {
    return '[CONFIG] Invalid connection settings. Check the staging env file and password URI encoding.';
  }
  return '[UNKNOWN] Check the staging env settings and network. Raw error details are hidden to protect credentials.';
}
