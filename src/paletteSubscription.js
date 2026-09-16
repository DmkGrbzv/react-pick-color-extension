// Read on mount and when shown again. A late read may never replace a newer event.
export function createPaletteSubscription( { read, subscribe, onValue, onError } ) {
  let active = true;
  let revision = 0;
  let requestId = 0;
  const unsubscribe = subscribe(
    ( value ) => {
      revision++;
      if ( active ) onValue( value );
    },
    ( error ) => {
      revision++;
      if ( active ) onError( error );
    }
  );

  async function refresh() {
    const request = ++requestId;
    const before = revision;
    try {
      const value = await read();
      if ( active && request === requestId && revision === before ) onValue( value );
    } catch ( error ) {
      if ( active && request === requestId && revision === before ) onError( error );
    }
  }

  return {
    refresh,
    dispose() {
      active = false;
      unsubscribe();
    },
  };
}
