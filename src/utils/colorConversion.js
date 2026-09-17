export const COLOR_FORMATS = ['hex', 'rgb', 'cmyk'];
export function hexToRgb( hex ) {
  if ( typeof hex !== 'string' || !/^#([\da-f]{3}|[\da-f]{6})$/i.test( hex ) )
    throw new Error( 'Invalid HEX' );
  const value =
    hex.length === 4 ? [...hex.slice( 1 )].map( ( char ) => char + char ).join( '' ) : hex.slice( 1 );
  return {
    red: parseInt( value.slice( 0, 2 ), 16 ),
    green: parseInt( value.slice( 2, 4 ), 16 ),
    blue: parseInt( value.slice( 4, 6 ), 16 ),
  };
}
export function rgbToCmyk( red, green, blue ) {
  if ( ![red, green, blue].every( ( value ) => Number.isInteger( value ) && value >= 0 && value <= 255 ) )
    throw new Error( 'Invalid RGB' );
  const max = Math.max( red, green, blue );
  if ( max === 0 ) return { cyan: 0, magenta: 0, yellow: 0, black: 100 };
  return {
    cyan: Math.round( ( 1 - red / max ) * 100 ),
    magenta: Math.round( ( 1 - green / max ) * 100 ),
    yellow: Math.round( ( 1 - blue / max ) * 100 ),
    black: Math.round( ( 1 - max / 255 ) * 100 ),
  };
}
export function formatRgb( { red, green, blue } ) {
  return [red, green, blue].join( ', ' );
}
export function formatCmyk( { cyan, magenta, yellow, black } ) {
  return [cyan, magenta, yellow, black].map( ( value ) => value + '%' ).join( ', ' );
}
export function colorValues( hex ) {
  const rgb = hexToRgb( hex );
  return {
    hex: hex.toUpperCase(),
    rgb: formatRgb( rgb ),
    cmyk: formatCmyk( rgbToCmyk( rgb.red, rgb.green, rgb.blue ) ),
  };
}
