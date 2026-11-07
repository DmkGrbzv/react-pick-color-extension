import { stripVTControlCharacters } from 'node:util';

export const CHECKS = Object.freeze( {
  frontend: { install: ['ci'], lint: ['run', 'lint'], tests: ['test'], build: ['run', 'build'], verify: ['run', 'verify:extension'] },
  backend: { install: ['ci'], tests: ['test'], mongo: ['run', 'test:mongo'] },
  image: { build: ['build', '--pull', '--build-arg', 'REVISION', '--tag', 'palette-backend:ci', 'backend'] },
} );

export const DIAGNOSTICS = Object.freeze( {
  commandFailed: 'Command exited unsuccessfully. See the Actions log for details.',
  assertion: 'A test assertion failed; assertion values are deliberately omitted.',
  syntax: 'A syntax error was reported.',
  missingFile: 'A required file or module could not be found.',
  connection: 'A connection was refused.',
  lint: 'ESLint reported problems; source lines and messages are omitted.',
  architecture: 'The architecture audit failed; see the Actions log for details.',
  build: 'The build reported a resolution or transformation error.',
  interrupted: 'The command was interrupted before completing.',
} );
const METRICS = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'duration_ms', 'lintErrors', 'lintWarnings',
  'modules', 'imports', 'cycles', 'violations', 'builtModules'];

export function summarizeOutput( output, exitCode ) {
  const text = stripVTControlCharacters( output );
  const metrics = {};
  for ( const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'duration_ms'] ) {
    const matches = [...text.matchAll( new RegExp( '^# ' + key + ' (\\d+(?:\\.\\d+)?)\\s*$', 'gm' ) )];
    if ( matches.length ) metrics[key] = Number( matches.at( -1 )[1] );
  }
  const lint = text.match( /\d+ problems? \((\d+) errors?, (\d+) warnings?\)/ );
  if ( lint ) Object.assign( metrics, { lintErrors: Number( lint[1] ), lintWarnings: Number( lint[2] ) } );
  const architecture = text.match( /Architecture verified: (\d+) modules, (\d+) internal imports, (\d+) cycles, (\d+) boundary violations/ );
  if ( architecture ) ['modules', 'imports', 'cycles', 'violations'].forEach( ( key, index ) => {
    metrics[key] = Number( architecture[index + 1] );
  } );
  const build = text.match( /(\d+) modules transformed/ );
  if ( build ) metrics.builtModules = Number( build[1] );
  const patterns = { assertion: /ERR_ASSERTION/, syntax: /SyntaxError/,
    missingFile: /ENOENT|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/, connection: /ECONNREFUSED/,
    lint: /\d+ problems? \(/, architecture: /^Import cycle:|boundary violation:/m,
    build: /Could not resolve|Transform failed/ };
  const codes = Object.entries( patterns ).filter( ( [, pattern] ) => pattern.test( text ) ).map( ( [code] ) => code );
  if ( exitCode !== 0 && /(?:^> |npm notice run )node scripts[/\\]checkArchitecture\.js/m.test( text ) ) codes.push( 'architecture' );
  if ( exitCode !== 0 ) codes.unshift( 'commandFailed' );
  return { metrics, diagnosticCodes: [...new Set( codes )].slice( 0, 4 ) };
}

// Rebuild from an allowlist at both collection and publication boundaries.
// Never forward raw stdout, exception messages, filenames, URLs or environment values.
export function safeResult( value ) {
  const metrics = Object.fromEntries( METRICS.filter( ( key ) =>
    Number.isFinite( value?.metrics?.[key] ) && value.metrics[key] >= 0 && value.metrics[key] <= 1e9
  ).map( ( key ) => [key, value.metrics[key]] ) );
  const diagnosticCodes = Object.keys( DIAGNOSTICS ).filter( ( key ) => value?.diagnosticCodes?.includes( key ) ).slice( 0, 4 );
  const exitCode = Number.isInteger( value?.exitCode ) && value.exitCode >= 0 && value.exitCode <= 255 ? value.exitCode : null;
  return { exitCode, metrics, diagnosticCodes };
}
