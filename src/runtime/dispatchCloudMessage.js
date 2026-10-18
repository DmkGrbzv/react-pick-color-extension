import { AppError } from '@/errors.js';
import { EXTENSION_PAGES } from '@/constants/extensionPages.js';

export function isCloudSender( sender, extensionId, extensionUrl = 'chrome-extension://' + extensionId + '/' ) {
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

export function dispatchCloudMessage( cloud, message ) {
  if ( !cloud ) {
    if ( message.type === 'cloud:state' ) return { configured: false, user: null, pending: null };
    throw new AppError( 'cloudUnavailable' );
  }
  switch ( message.type ) {
    case 'cloud:state': return cloud.state();
    case 'cloud:signIn': return cloud.signIn();
    case 'cloud:logout': return cloud.logout();
    case 'cloud:prepare': return cloud.prepare();
    case 'cloud:cancelSave': return cloud.cancelSave();
    case 'cloud:nameSave': return cloud.renamePending( message.key, message.name );
    case 'cloud:save': return cloud.save( message.key );
    case 'cloud:list': return cloud.list( message.cursor );
    case 'cloud:get': return cloud.get( message.id );
    case 'cloud:open': return cloud.open( message.id, message.expectedVersion );
    case 'cloud:rename': return cloud.rename( message.id, message.name );
    case 'cloud:remove': return cloud.remove( message.id );
    default: throw new AppError( 'unknownOperation' );
  }
}
