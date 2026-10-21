import { AppError } from '@/utils/errors.js';
import { EXTENSION_PAGES } from '@/constants/extensionPages.js';

export function isLibrarySender( sender, extensionId, extensionUrl = 'chrome-extension://' + extensionId + '/' ) {
  if ( sender.id !== extensionId || typeof sender.url !== 'string' ) return false;
  const pages = [EXTENSION_PAGES.EDITOR, EXTENSION_PAGES.SIDE_PANEL, EXTENSION_PAGES.LIBRARY, EXTENSION_PAGES.PRINT];
  try {
    const url = new URL( sender.url );
    const expected = new URL( extensionUrl );
    return ['chrome-extension:', 'moz-extension:'].includes( url.protocol ) &&
      url.protocol === expected.protocol && url.host === expected.host &&
      pages.includes( url.pathname.slice( 1 ) );
  } catch {
    return false;
  }
}

export function dispatchLibraryMessage( library, message ) {
  if ( !library ) {
    if ( message.type === 'cloud:state' ) return { configured: false, user: null, pending: null };
    throw new AppError( 'cloudUnavailable' );
  }
  switch ( message.type ) {
    case 'cloud:state': return library.state();
    case 'cloud:signIn': return library.signIn();
    case 'cloud:logout': return library.logout();
    case 'cloud:prepare': return library.prepare();
    case 'cloud:cancelSave': return library.cancelSave();
    case 'cloud:nameSave': return library.renamePending( message.key, message.name );
    case 'cloud:save': return library.save( message.key );
    case 'cloud:list': return library.list( message.cursor );
    case 'cloud:get': return library.get( message.id );
    case 'cloud:open': return library.open( message.id, message.expectedVersion );
    case 'cloud:rename': return library.rename( message.id, message.name );
    case 'cloud:remove': return library.remove( message.id );
    default: throw new AppError( 'unknownOperation' );
  }
}
