// Infrastructure only: no palette rules, message routing or error handling.
export function createStorageAdapter( api ) {
  return {
    async get( key ) {
      const values = await api.local.get( key );
      return values[key];
    },
    async set( key, value ) {
      await api.local.set( { [key]: value } );
    },
    subscribe( key, onChange ) {
      const listener = ( changes, area ) => {
        if ( area === 'local' && Object.hasOwn( changes, key ) ) {
          onChange( changes[key].newValue );
        }
      };
      api.onChanged.addListener( listener );
      return () => api.onChanged.removeListener( listener );
    },
  };
}
