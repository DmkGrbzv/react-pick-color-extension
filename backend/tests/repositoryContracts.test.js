import { AuthMemoryRepository } from './helpers/authMemory.js';
import { PaletteMemoryRepository } from './helpers/paletteMemory.js';
import { authRepositoryContract } from './contracts/authRepository.js';
import { paletteRepositoryContract } from './contracts/paletteRepository.js';

async function memoryFactory() {
  const palettes = new PaletteMemoryRepository( () => new Date( '2026-01-01T00:00:00.123Z' ) );
  palettes.quotas.set( 'A', 0 );
  palettes.quotas.set( 'B', 0 );
  return { auth: new AuthMemoryRepository(), palettes, owner: 'A', other: 'B',
    quota: async ( owner ) => palettes.quotas.get( owner ),
    setQuota: async ( owner, value ) => { palettes.quotas.set( owner, value ); } };
}

authRepositoryContract( 'Memory auth', memoryFactory );
paletteRepositoryContract( 'Memory palettes', memoryFactory );
