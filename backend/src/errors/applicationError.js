// Stable application codes; transport adapters decide how to present them.
export class ApplicationError extends Error {
  constructor( code, reason ) {
    super( code );
    this.name = 'ApplicationError';
    this.code = code;
    if ( reason ) this.reason = reason;
  }
}
