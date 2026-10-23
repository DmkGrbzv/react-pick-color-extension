import { appName } from '../src/constants/branding.js';

export function resolveAppName( value ) {
  const name = value?.trim() || appName;
  if ( name.length > 75 || Array.from( name ).some( ( character ) => character.charCodeAt( 0 ) < 0x20 ) ) {
    throw new Error( 'VITE_APP_NAME must be a single line of at most 75 characters' );
  }
  return name;
}

export function brandingPlugin( name ) {
  const escaped = name.replaceAll( '&', '&amp;' ).replaceAll( '<', '&lt;' ).replaceAll( '>', '&gt;' );
  return {
    name: 'app-branding',
    config: () => ( { define: { 'import.meta.env.VITE_APP_NAME': JSON.stringify( name ) } } ),
    transformIndexHtml: ( html ) => html.replace( /<title>[^<]*<\/title>/, () => '<title>' + escaped + '</title>' ),
  };
}
