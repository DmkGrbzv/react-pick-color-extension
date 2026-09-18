import { ERROR_CODES } from '@/constants/errorCodes.js';
import { AppError } from '@/errors.js';

export function requireExtension() {
  if ( !globalThis.chrome?.runtime?.id ) throw new AppError( ERROR_CODES.EXTENSION_REQUIRED );
}

export async function sendRequest( message ) {
  requireExtension();
  let response;
  try {
    response = await chrome.runtime.sendMessage( message );
  } catch ( cause ) {
    throw new AppError( ERROR_CODES.EXTENSION_UNAVAILABLE, { cause } );
  }
  if ( !response?.ok ) {
    throw new AppError(
      response?.error || ERROR_CODES.EXTENSION_UNAVAILABLE,
      response?.details ? { cause: new Error( response.details ) } : undefined
    );
  }
  return response.value;
}
