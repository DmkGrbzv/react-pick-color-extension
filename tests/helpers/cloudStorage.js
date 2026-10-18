function area( data, notify ) {
  return {
    data,
    setAccessLevel: async () => {},
    async get( key ) { return { [key]: structuredClone( data[key] ) }; },
    async set( values ) {
      const changes = {};
      for ( const [key, value] of Object.entries( values ) ) {
        changes[key] = { oldValue: structuredClone( data[key] ), newValue: structuredClone( value ) };
        data[key] = structuredClone( value );
      }
      notify( changes );
    },
    async remove( key ) {
      const oldValue = structuredClone( data[key] );
      delete data[key];
      notify( { [key]: { oldValue } } );
    },
  };
}

export function createCloudStorage() {
  const listeners = new Set();
  return {
    local: area( {}, ( changes ) => { for ( const listener of listeners ) listener( changes, 'local' ); } ),
    session: area( {}, ( changes ) => { for ( const listener of listeners ) listener( changes, 'session' ); } ),
    onChanged: {
      addListener: ( listener ) => listeners.add( listener ),
      removeListener: ( listener ) => listeners.delete( listener ),
    },
    listeners,
  };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise( ( accept, fail ) => { resolve = accept; reject = fail; } );
  return { promise, resolve, reject };
}
