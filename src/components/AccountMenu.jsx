import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function AccountMenu( { user, busy, onSignIn, onSignOut } ) {
  const { t } = useTranslation();
  const element = useRef( null );
  useEffect( () => {
    const dismiss = ( event ) => {
      if ( element.current && !element.current.contains( event.target ) ) element.current.open = false;
    };
    document.addEventListener( 'pointerdown', dismiss );
    return () => document.removeEventListener( 'pointerdown', dismiss );
  }, [] );

  function keyDown( event ) {
    if ( event.key !== 'Escape' ) return;
    element.current.open = false;
    element.current.querySelector( 'summary' ).focus();
  }

  function select() {
    element.current.open = false;
    void ( user ? onSignOut() : onSignIn() );
  }

  return (
    <details className="app-account" ref={ element } onKeyDown={ keyDown }>
      <summary>{ t( 'navigation.account' ) }<span className={ user ? 'account-connected' : 'account-guest' } aria-hidden="true" /></summary>
      <div className="app-account-menu">
        <p>{ user?.email || t( user ? 'cloud.account' : 'navigation.guest' ) }</p>
        <button type="button" disabled={ busy } onClick={ select }>{ t( user ? 'cloud.logout' : 'cloud.login' ) }</button>
      </div>
    </details>
  );
}
