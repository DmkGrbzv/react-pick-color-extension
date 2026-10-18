import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const secret = () => randomBytes( 32 ).toString( 'base64url' );
export const digest = ( value ) => createHash( 'sha256' ).update( value ).digest( 'base64url' );

export function matches( left, right ) {
  if ( typeof left !== 'string' || typeof right !== 'string' ) return false;
  return timingSafeEqual( Buffer.from( digest( left ) ), Buffer.from( digest( right ) ) );
}
