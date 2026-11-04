import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeSource } from './architectureSource.js';
import { findCycles, checkBoundaries, resolveSourceImport } from './architectureRules.js';

const root = fileURLToPath( new URL( '../', import.meta.url ) );

async function sourceFiles() {
  const groups = await Promise.all( ['src', 'backend/src'].map( async ( directory ) => {
    const files = await readdir( path.join( root, directory ), { recursive: true } );
    return files.filter( ( file ) => /\.(js|jsx)$/.test( file ) )
      .map( ( file ) => directory + '/' + file.replaceAll( '\\', '/' ) );
  } ) );
  return groups.flat().sort();
}

async function buildGraph() {
  const graph = new Map();
  let internalImports = 0;
  const sourceViolations = [];
  for ( const file of await sourceFiles() ) {
    const text = await readFile( path.join( root, file ), 'utf8' );
    const analyzed = analyzeSource( file, text );
    sourceViolations.push( ...analyzed.violations );
    const imports = analyzed.imports.map( ( specifier ) => resolveSourceImport( file, specifier ) );
    for ( const target of imports.filter( ( target ) => /^(src|backend\/src)\//.test( target ) ) ) {
      await access( path.join( root, target ) );
      internalImports++;
    }
    graph.set( file, imports );
  }
  return { graph, internalImports, sourceViolations };
}

const { graph, internalImports, sourceViolations } = await buildGraph();
const cycles = findCycles( graph );
const violations = [...checkBoundaries( graph ), ...sourceViolations];
if ( cycles.length || violations.length ) {
  for ( const cycle of cycles ) console.error( 'Import cycle: ' + cycle.join( ' -> ' ) );
  for ( const violation of violations ) console.error( violation );
  process.exitCode = 1;
} else {
  console.log( 'Architecture verified: ' + graph.size + ' modules, ' + internalImports +
    ' internal imports, 0 cycles, 0 boundary violations.' );
}
