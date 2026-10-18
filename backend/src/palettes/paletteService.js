import { ApiError } from '../http/apiError.js';
import { decodeCursor, normalizeSnapshot, paletteName, publicPalette, saveKey, snapshotHash } from './paletteValidation.js';

export class CloudPaletteService {
  #repository;
  #config;
  constructor( { repository, config } ) {
    this.#repository = repository;
    this.#config = config;
  }

  async save( ownerId, input, key ) {
    const snapshot = normalizeSnapshot( input, this.#config.maxItems );
    const payloadHash = snapshotHash( snapshot );
    const result = await this.#repository.create( {
      ownerId, key: saveKey( key ), snapshot, payloadHash, maximum: this.#config.maxPalettes,
    } );
    if ( result.document.deletedAt ) throw new ApiError( 410, 'snapshotDeleted' );
    if ( result.document.payloadHash !== payloadHash ) throw new ApiError( 409, 'saveConflict' );
    return { palette: publicPalette( result.document ), created: result.created };
  }

  list( ownerId, query ) {
    const limit = query.limit === undefined ? 20 : Number( query.limit );
    if ( !Number.isInteger( limit ) || limit < 1 || limit > 50 ) throw new ApiError( 400, 'invalidCursor' );
    return this.#repository.list( ownerId, { cursor: decodeCursor( query.cursor ), limit } );
  }

  async get( ownerId, id ) {
    const value = await this.#repository.find( ownerId, id );
    if ( !value ) throw new ApiError( 404, 'notFound' );
    return publicPalette( value );
  }

  async rename( ownerId, id, input ) {
    if ( !input || Object.keys( input ).length !== 1 || !Object.hasOwn( input, 'name' ) ) {
      throw new ApiError( 400, 'invalidPalette' );
    }
    const value = await this.#repository.rename( ownerId, id, paletteName( input.name ) );
    if ( !value ) throw new ApiError( 404, 'notFound' );
    return publicPalette( value );
  }

  async remove( ownerId, id ) {
    if ( !await this.#repository.remove( ownerId, id ) ) throw new ApiError( 404, 'notFound' );
  }
}
