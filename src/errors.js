export class AppError extends Error {
  constructor( code, options ) {
    super( code, options );
    this.name = 'AppError';
    this.code = code;
  }
}

const codes = new Set( [
  'invalidGradient',
  'gradientMissing',
  'invalidPalette',
  'invalidHex',
  'missingColor',
  'unknownOperation',
  'extensionRequired',
  'extensionUnavailable',
  'storageFailure',
] );

// Browser/OS error text is not shown directly: it can be in any language.
export function errorKey( error, fallback ) {
  return `errors.${codes.has( error?.code ) ? error.code : fallback}`;
}
