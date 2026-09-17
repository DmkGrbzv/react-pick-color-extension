import { createStorageAdapter } from '@/storage.js';
import { createPaletteRepository } from '@/services/paletteRepository.js';
import { createPaletteService } from '@/services/paletteService.js';
import { createRouter } from '@/runtime/createRouter.js';

export function createPaletteExecutor( local, makeId ) {
  const repository = createPaletteRepository( createStorageAdapter( { local } ) );
  const paletteService = createPaletteService( repository, makeId );
  return createRouter( { paletteService } );
}
