import path from 'node:path';

const shared = /^src\/(components|layouts|services|utils|types|constants|i18n)\//;
const application = /^src\/(features|pages|routes|extension|api)\/|^src\/(App|main)\.jsx$/;
const workerOnly = /^src\/(api\/client\.js|extension\/(background\.js|messaging\/(createListener|dispatchMessage|dispatchLibraryMessage)\.js)|features\/auth\/services\/|features\/saved-palettes\/services\/)/;

export function resolveSourceImport( file, specifier ) {
  let target;
  if ( specifier.startsWith( '@/' ) ) target = path.posix.normalize( 'src/' + specifier.slice( 2 ) );
  else if ( specifier.startsWith( '.' ) ) target = path.posix.normalize( path.posix.join( path.posix.dirname( file ), specifier ) );
  else return specifier;
  if ( !target.startsWith( 'src/' ) ) throw new Error( file + ' imports outside src: ' + specifier );
  return target;
}

function reachable( graph, start ) {
  const visited = new Set();
  const pending = [start];
  while ( pending.length ) {
    const file = pending.pop();
    if ( visited.has( file ) ) continue;
    visited.add( file );
    pending.push( ...( graph.get( file ) || [] ) );
  }
  return visited;
}

export function findCycles( graph ) {
  const visited = new Set();
  const active = [];
  const cycles = [];
  function visit( file ) {
    const index = active.indexOf( file );
    if ( index >= 0 ) {
      cycles.push( [...active.slice( index ), file] );
      return;
    }
    if ( visited.has( file ) ) return;
    visited.add( file );
    active.push( file );
    for ( const target of graph.get( file ) || [] ) visit( target );
    active.pop();
  }
  for ( const file of graph.keys() ) visit( file );
  return cycles;
}

export function checkBoundaries( graph ) {
  const errors = new Set();
  for ( const [file, targets] of graph ) {
    for ( const target of targets ) {
      if ( shared.test( file ) && application.test( target ) ) {
        errors.add( file + ' imports application functionality: ' + target );
      }
      if ( file.startsWith( 'src/features/' ) && /^src\/(pages|layouts)\/|^src\/(App|main)\.jsx$/.test( target ) ) {
        errors.add( file + ' imports application composition: ' + target );
      }
      if ( /\/(services|models|utils)\/|^src\/api\//.test( file ) && /^(react|react-dom)(\/|$)|\.jsx$/.test( target ) ) {
        errors.add( file + ' imports React UI: ' + target );
      }
    }
  }
  for ( const target of reachable( graph, 'src/main.jsx' ) ) {
    if ( workerOnly.test( target ) ) errors.add( 'UI reaches worker-only code: ' + target );
  }
  for ( const target of reachable( graph, 'src/extension/background.js' ) ) {
    if ( /^(react|react-dom)(\/|$)|\.jsx$/.test( target ) ) {
      errors.add( 'Service worker reaches React UI: ' + target );
    }
  }
  return [...errors].sort();
}
