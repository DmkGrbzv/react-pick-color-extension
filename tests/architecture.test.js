import test from 'node:test';
import assert from 'node:assert/strict';
import { findCycles, checkBoundaries, resolveSourceImport } from '../scripts/architectureRules.js';

test( 'dependency audit accepts shared presentation and separate UI/worker composition', () => {
  const graph = new Map( [
    ['src/main.jsx', ['src/App.jsx']],
    ['src/App.jsx', ['src/layouts/MainLayout.jsx', 'src/pages/WorkingPalette/Page.jsx']],
    ['src/layouts/MainLayout.jsx', ['src/components/common/AppFooter.jsx']],
    ['src/pages/WorkingPalette/Page.jsx', ['src/features/palette/components/List.jsx']],
    ['src/extension/background.js', ['src/api/client.js']],
    ['src/api/client.js', ['src/utils/errors.js']],
  ] );
  assert.deepEqual( checkBoundaries( graph ), [] );
  assert.deepEqual( findCycles( graph ), [] );
} );

test( 'dependency audit rejects shared components importing features and feature models importing UI', () => {
  const graph = new Map( [
    ['src/components/common/Header.jsx', ['src/features/auth/components/AccountMenu.jsx']],
    ['src/features/saved-palettes/models/library.js', ['react', 'src/pages/SavedPalettes/Page.jsx']],
  ] );
  const violations = checkBoundaries( graph );
  assert.ok( violations.some( ( error ) => error.includes( 'imports application functionality' ) ) );
  assert.ok( violations.some( ( error ) => error.includes( 'imports React UI' ) ) );
  assert.ok( violations.some( ( error ) => error.includes( 'imports application composition' ) ) );
} );

test( 'dependency audit follows indirect UI access to credentials and worker access to React', () => {
  const graph = new Map( [
    ['src/main.jsx', ['src/features/palette/hooks/usePalette.js']],
    ['src/features/palette/hooks/usePalette.js', ['src/features/auth/services/sessionStore.js']],
    ['src/extension/background.js', ['src/features/palette/services/paletteService.js']],
    ['src/features/palette/services/paletteService.js', ['react-dom/client']],
  ] );
  const violations = checkBoundaries( graph );
  assert.ok( violations.some( ( error ) => error.includes( 'UI reaches worker-only code' ) ) );
  assert.ok( violations.some( ( error ) => error.includes( 'Service worker reaches React UI' ) ) );
} );

test( 'dependency audit reports circular imports without treating shared dependencies as cycles', () => {
  const graph = new Map( [['a', ['b', 'shared']], ['b', ['c', 'shared']], ['c', ['a']], ['shared', []]] );
  assert.deepEqual( findCycles( graph ), [['a', 'b', 'c', 'a']] );
} );
test( 'dependency audit normalizes aliases and relative paths before checking boundaries', () => {
  assert.equal( resolveSourceImport( 'src/components/ui/Icon.jsx', '@/components/../features/auth/session.js' ), 'src/features/auth/session.js' );
  assert.equal( resolveSourceImport( 'src/components/ui/Icon.jsx', '../../features/auth/session.js' ), 'src/features/auth/session.js' );
  assert.throws( () => resolveSourceImport( 'src/App.jsx', '../backend/src/server.js' ), /outside src/ );
} );
