import { StorageAdapter } from '@/services/storage.js';
import { PaletteRepository } from '@/features/palette/services/paletteRepository.js';
import { PaletteService } from '@/features/palette/services/paletteService.js';
import { dispatchMessage } from '@/extension/messaging/dispatchMessage.js';

export function createPaletteExecutor( local, makeId ) {
  const repository = new PaletteRepository( new StorageAdapter( { local } ) );
  const paletteService = new PaletteService( repository, makeId );
  return ( message, sender ) => dispatchMessage( { paletteService }, message, sender );
}
