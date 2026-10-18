export const APP_VIEWS = Object.freeze( ['working', 'library', 'print'] );

export function readAppView( hash, fallback = 'working' ) {
  const params = new URLSearchParams( hash.replace( /^#/, '' ) );
  if ( params.has( 'gradient' ) ) return 'working';
  const view = params.get( 'view' );
  return APP_VIEWS.includes( view ) ? view : fallback;
}

export function appViewHash( view ) {
  if ( !APP_VIEWS.includes( view ) ) throw new RangeError( 'Unknown app view' );
  return '#view=' + view;
}

export function clearGradientRequest() {
  const params = new URLSearchParams( window.location.hash.slice( 1 ) );
  params.delete( 'gradient' );
  params.delete( 'request' );
  params.set( 'view', 'working' );
  window.history.replaceState( null, '', '#' + params );
}
