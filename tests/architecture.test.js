import test from 'node:test';
import assert from 'node:assert/strict';
import { findCycles, checkBoundaries, resolveSourceImport } from '../scripts/architectureRules.js';
import { analyzeSource } from '../scripts/architectureSource.js';

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

test( 'backend audit permits assembly and neutral contracts, rejects infrastructure leaks', () => {
  const graph = new Map( [
    ['backend/src/server.js', ['backend/src/infrastructure/mongodb/connectStorage.js', 'backend/src/auth/authService.js']],
    ['backend/src/auth/authService.js', ['backend/src/errors/applicationError.js']],
    ['backend/src/infrastructure/mongodb/authRepository.js', ['mongodb', 'backend/src/errors/applicationError.js']],
    ['backend/src/http/middleware.js', ['backend/src/errors/applicationError.js']],
  ] );
  assert.deepEqual( checkBoundaries( graph ), [] );
  for ( const target of ['mongodb', 'mongodb/lib/client.js', 'express', 'openid-client',
    'backend/src/infrastructure/mongodb/authRepository.js', 'backend/src/http/apiError.js', 'backend/src/config.js'] ) {
    const invalid = new Map( [['backend/src/auth/authService.js', [target]]] );
    assert.ok( checkBoundaries( invalid ).some( ( value ) => value.includes( 'backend infrastructure or transport' ) ) );
  }
  assert.ok( checkBoundaries( new Map( [
    ['backend/src/infrastructure/mongodb/paletteRepository.js', ['backend/src/http/apiError.js']],
  ] ) ).some( ( value ) => value.includes( 'HTTP from infrastructure' ) ) );
  assert.equal( resolveSourceImport( 'backend/src/auth/authService.js', '../contracts/authRepository.js' ),
    'backend/src/contracts/authRepository.js' );
  assert.throws( () => resolveSourceImport( 'backend/src/auth/authService.js', '../../../src/App.jsx' ), /outside backend\/src/ );
  assert.ok( checkBoundaries( new Map( [
    ['backend/src/auth/authService.js', ['backend/src/helpers/storage.js']],
    ['backend/src/helpers/storage.js', ['mongodb']],
  ] ) ).some( ( value ) => value.includes( 'reaches backend infrastructure or transport: mongodb' ) ) );
  assert.ok( checkBoundaries( new Map( [
    ['backend/src/http/middleware.js', ['backend/src/infrastructure/mongodb/rateLimiter.js']],
  ] ) ).some( ( value ) => value.includes( 'concrete infrastructure from HTTP' ) ) );
} );

test( 'backend cycles across application and infrastructure are reported', () => {
  const application = 'backend/src/auth/authService.js';
  const adapter = 'backend/src/infrastructure/mongodb/authRepository.js';
  assert.deepEqual( findCycles( new Map( [[application, [adapter]], [adapter, [application]]] ) ),
    [[application, adapter, application]] );
} );

test( 'source audit rejects direct Chrome/session-key access in account hooks and policy', () => {
  const hook = 'src/features/saved-palettes/hooks/useSavedPalettes.js';
  for ( const source of [
    'chrome.storage.local.get("key")', 'globalThis.chrome.storage.onChanged.addListener(callback)',
    'window["chrome"]["storage"].local.get("key")', 'const { storage } = chrome;',
    'const SESSION_KEY = "cloudSession";',
  ] ) assert.ok( analyzeSource( hook, source ).violations.length, source );
  assert.ok( analyzeSource( 'src/features/auth/services/sessionStore.js', 'storage.local.setAccessLevel({});' ).violations.length );
  const imports = ['src/features/auth/constants/sessionKeys.js'];
  assert.ok( checkBoundaries( new Map( [[hook, imports]] ) ).some( ( value ) => value.includes( 'storage keys' ) ) );
  assert.deepEqual( analyzeSource( hook,
    'import { subscribeToAccountEvents } from "../adapters/accountEvents.js"; subscribeToAccountEvents(callbacks);' ).violations, [] );
  assert.deepEqual( analyzeSource( 'src/features/auth/adapters/accountEvents.js', 'chrome.storage.onChanged.addListener(callback);' ).violations, [] );
  assert.throws( () => analyzeSource( hook, 'import(path)' ), /computed dynamic import/ );
  assert.deepEqual( analyzeSource( hook, 'export { x } from "./module.js"; import("./other.js");' ).imports,
    ['./module.js', './other.js'] );
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
