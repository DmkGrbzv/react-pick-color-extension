import { createStorageAdapter } from '@/storage.js';
import { requireExtension } from '@/runtime/sendRequest.js';
import { COLOR_FORMATS } from '@/utils/colorConversion.js';
const KEY = 'colorFormat';
const normalize = ( value ) => ( COLOR_FORMATS.includes( value ) ? value : 'hex' );
export function createColorFormatClient( api ) {
  const storage = createStorageAdapter( api );
  return {
    async read() {
      return normalize( await storage.get( KEY ) );
    },
    async save( value ) {
      if ( !COLOR_FORMATS.includes( value ) ) throw new Error( 'Invalid color format' );
      await storage.set( KEY, value );
    },
    subscribe( onChange ) {
      return storage.subscribe( KEY, ( value ) => onChange( normalize( value ) ) );
    },
  };
}
export function getColorFormatClient() {
  requireExtension();
  return createColorFormatClient( chrome.storage );
}
