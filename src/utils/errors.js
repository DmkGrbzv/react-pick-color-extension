import { ERROR_CODES } from '@/constants/errorCodes.js';
export class AppError extends Error {
  constructor( code, options ) {
    super( code, options );
    this.name = 'AppError';
    this.code = code;
  }
}

const codes = new Set( [
  ERROR_CODES.INVALID_GRADIENT,
  ERROR_CODES.GRADIENT_MISSING,
  ERROR_CODES.INVALID_PALETTE,
  ERROR_CODES.INVALID_HEX,
  ERROR_CODES.MISSING_COLOR,
  ERROR_CODES.UNKNOWN_OPERATION,
  ERROR_CODES.EXTENSION_REQUIRED,
  ERROR_CODES.EXTENSION_UNAVAILABLE,
  ERROR_CODES.STORAGE_FAILURE,
] );

// Browser/OS error text is not shown directly: it can be in any language.
export function errorKey( error, fallback ) {
  return `errors.${codes.has( error?.code ) ? error.code : fallback}`;
}
