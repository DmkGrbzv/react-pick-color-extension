import { ApplicationError } from '../errors/applicationError.js';

const statuses = {
  invalidAuthRequest: 400, invalidIdentity: 401, authConfiguration: 502, unauthorized: 401,
  invalidPalette: 400, invalidSaveKey: 400, invalidCursor: 400, notFound: 404,
  paletteLimit: 409, saveConflict: 409, snapshotDeleted: 410, rateLimited: 429, serverError: 500,
};

export function applicationErrorResponse( error ) {
  if ( !( error instanceof ApplicationError ) ) return null;
  const code = Object.hasOwn( statuses, error.code ) ? error.code : 'serverError';
  const status = code === 'invalidAuthRequest' && error.reason === 'unusableCredential' ? 401 : statuses[code];
  return { status, code };
}
