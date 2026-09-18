import { useEffect, useRef, useState } from 'react';
import { ColorFormatPreference } from '@/preferences/colorFormatPreference.js';
export function useColorFormat() {
  const [format, setFormat] = useState( 'hex' );
  const [ready, setReady] = useState( false );
  const [saving, setSaving] = useState( false );
  const [error, setError] = useState( false );
  const preferenceRef = useRef( null );
  const revision = useRef( 0 );
  const locked = useRef( false );
  useEffect( () => {
    let active = true;
    let unsubscribe;
    async function load() {
      try {
        preferenceRef.current = new ColorFormatPreference();
        unsubscribe = preferenceRef.current.subscribe( ( value ) => {
          revision.current++;
          if ( active ) setFormat( value );
        } );
        const before = revision.current;
        const value = await preferenceRef.current.read();
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
      const preference = preferenceRef.current || new ColorFormatPreference();
      const before = revision.current;
      await preference.save( value );
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
