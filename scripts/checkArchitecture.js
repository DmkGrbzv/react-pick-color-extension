import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import { findCycles, checkBoundaries, resolveSourceImport } from './architectureRules.js';

const root = fileURLToPath( new URL( '../', import.meta.url ) );
const linter = new Linter();

async function sourceFiles() {
  const files = await readdir( path.join( root, 'src' ), { recursive: true } );
  return files.filter( ( file ) => /\.(js|jsx)$/.test( file ) )
    .map( ( file ) => 'src/' + file.replaceAll( '\\', '/' ) ).sort();
}

function collectImports( file, text ) {
  const imports = [];
  const record = ( node ) => { if ( typeof node?.value === 'string' ) imports.push( node.value ); };
  const rule = { create: () => ( {
    ImportDeclaration: ( node ) => record( node.source ),
    ExportNamedDeclaration: ( node ) => record( node.source ),
    ExportAllDeclaration: ( node ) => record( node.source ),
    ImportExpression: ( node ) => {
      if ( typeof node.source?.value !== 'string' ) throw new Error( 'Cannot audit a computed dynamic import' );
      record( node.source );
    },
  } ) };
  const messages = linter.verify( text, [{
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { architecture: { rules: { imports: rule } } },
    rules: { 'architecture/imports': 'error' },
  }], { filename: file } );
  if ( messages.some( ( message ) => message.severity === 2 ) ) {
    throw new Error( file + ': ' + messages.map( ( message ) => message.message ).join( '; ' ) );
  }
  return imports;
}

async function buildGraph() {
  const graph = new Map();
  let internalImports = 0;
  for ( const file of await sourceFiles() ) {
    const text = await readFile( path.join( root, file ), 'utf8' );
    const imports = collectImports( file, text ).map( ( specifier ) => resolveSourceImport( file, specifier ) );
    for ( const target of imports.filter( ( target ) => target.startsWith( 'src/' ) ) ) {
      await access( path.join( root, target ) );
      internalImports++;
    }
    graph.set( file, imports );
  }
  return { graph, internalImports };
}

const { graph, internalImports } = await buildGraph();
const cycles = findCycles( graph );
const violations = checkBoundaries( graph );
if ( cycles.length || violations.length ) {
  for ( const cycle of cycles ) console.error( 'Import cycle: ' + cycle.join( ' -> ' ) );
  for ( const violation of violations ) console.error( violation );
  process.exitCode = 1;
} else {
  console.log( 'Architecture verified: ' + graph.size + ' modules, ' + internalImports +
    ' internal imports, 0 cycles, 0 boundary violations.' );
}
