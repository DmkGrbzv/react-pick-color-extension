import { AppError } from '@/errors.js';

export function requireExtension() {
  if ( !globalThis.chrome?.runtime?.id ) throw new AppError( 'extensionRequired' );
}

export async function sendRequest( message ) {
  requireExtension();
  let response;
  try {
    response = await chrome.runtime.sendMessage( message );
  } catch ( cause ) {
    throw new AppError( 'extensionUnavailable', { cause } );
  }
  if ( !response?.ok ) {
    throw new AppError(
      response?.error || 'extensionUnavailable',
      response?.details ? { cause: new Error( response.details ) } : undefined
    );
  }
  return response.value;
}
