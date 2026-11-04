import { ApplicationError } from '../errors/applicationError.js';
import { decodeCursor, encodeCursor, normalizeSnapshot, paletteName, publicPalette, saveKey, snapshotHash } from './paletteValidation.js';

export class SavedPaletteService {
  #repository;
  #config;
  /** @param {{repository: import('../contracts/paletteRepository.js').PaletteRepository, config: object}} dependencies */
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
    return { palette: publicPalette( result.palette ), created: result.created };
  }

  async list( ownerId, query ) {
    const limit = query.limit === undefined ? 20 : Number( query.limit );
    if ( !Number.isInteger( limit ) || limit < 1 || limit > 50 ) throw new ApplicationError( 'invalidCursor' );
    const page = await this.#repository.list( ownerId, { cursor: decodeCursor( query.cursor ), limit } );
    return { palettes: page.palettes.map( publicPalette ),
      nextCursor: page.continuation ? encodeCursor( page.continuation ) : null };
  }

  async get( ownerId, id ) {
    const value = await this.#repository.find( ownerId, id );
    if ( !value ) throw new ApplicationError( 'notFound' );
    return publicPalette( value );
  }

  async rename( ownerId, id, input ) {
    if ( !input || Object.keys( input ).length !== 1 || !Object.hasOwn( input, 'name' ) ) {
      throw new ApplicationError( 'invalidPalette' );
    }
    const value = await this.#repository.rename( ownerId, id, paletteName( input.name ) );
    if ( !value ) throw new ApplicationError( 'notFound' );
    return publicPalette( value );
  }

  async remove( ownerId, id ) {
    if ( !await this.#repository.remove( ownerId, id ) ) throw new ApplicationError( 'notFound' );
  }
}
