import { StorageAdapter } from '@/storage.js';
import { PaletteRepository } from '@/services/paletteRepository.js';
import { PaletteService } from '@/services/paletteService.js';
import { dispatchMessage } from '@/runtime/dispatchMessage.js';

export function createPaletteExecutor( local, makeId ) {
  const repository = new PaletteRepository( new StorageAdapter( { local } ) );
  const paletteService = new PaletteService( repository, makeId );
  return ( message, sender ) => dispatchMessage( { paletteService }, message, sender );
}
