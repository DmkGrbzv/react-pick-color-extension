import { useEffect, useRef, useState } from 'react';
import { ThemePreference } from '@/preferences/themePreference.js';
import { normalizeTheme } from '@/constants/themes.js';

export function useTheme() {
  const [theme, setTheme] = useState( () => normalizeTheme( document.documentElement.dataset.theme ) );
  const [ready, setReady] = useState( false );
  const [saving, setSaving] = useState( false );
  const [error, setError] = useState( false );
  const preference = useRef( null );
  const revision = useRef( 0 );
  const locked = useRef( false );

  useEffect( () => {
    let active = true;
    let unsubscribe;
    function apply( value ) {
      if ( !active ) return;
      document.documentElement.dataset.theme = value;
      setTheme( value );
    }
    async function load() {
      try {
        preference.current = new ThemePreference();
        unsubscribe = preference.current.subscribe( ( value ) => {
          revision.current++;
          apply( value );
        } );
        const before = revision.current;
        const value = await preference.current.read();
        if ( before === revision.current ) apply( value );
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
      const client = preference.current || new ThemePreference();
      const before = revision.current;
      await client.save( value );
      // A newer storage event wins over a delayed write response.
      if ( before === revision.current ) {
        document.documentElement.dataset.theme = value;
        setTheme( value );
      }
    } catch {
      setError( true );
    } finally {
      locked.current = false;
      setSaving( false );
    }
  }

  return { theme, change, error, disabled: !ready || saving };
}
