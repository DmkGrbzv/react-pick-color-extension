import { useEffect, useRef, useState } from 'react';
import { getColorFormatClient } from '@/api/colorFormatClient.js';
export function useColorFormat() {
  const [format, setFormat] = useState( 'hex' );
  const [ready, setReady] = useState( false );
  const [saving, setSaving] = useState( false );
  const [error, setError] = useState( false );
  const client = useRef( null );
  const revision = useRef( 0 );
  const locked = useRef( false );
  useEffect( () => {
    let active = true;
    let unsubscribe;
    async function load() {
      try {
        client.current = getColorFormatClient();
        unsubscribe = client.current.subscribe( ( value ) => {
          revision.current++;
          if ( active ) setFormat( value );
        } );
        const before = revision.current;
        const value = await client.current.read();
        if ( active && before === revision.current ) setFormat( value );
      } catch {
        if ( active ) setError( true );
      } finally {
        if ( active ) setReady( true );
      }
    }
    void load();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [] );
  async function change( value ) {
    if ( locked.current ) return;
    locked.current = true;
    setSaving( true );
    setError( false );
    try {
      const api = client.current || getColorFormatClient();
      const before = revision.current;
      await api.save( value );
      if ( before === revision.current ) setFormat( value );
    } catch {
      setError( true );
    } finally {
      locked.current = false;
      setSaving( false );
    }
  }
  return { format, change, error, disabled: !ready || saving };
}
