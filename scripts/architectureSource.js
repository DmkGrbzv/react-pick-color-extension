import { Linter } from 'eslint';

const linter = new Linter();
const sessionPolicy = /^src\/features\/auth\/services\/sessionStore\.js$/;
const sessionHook = /^src\/features\/(auth|saved-palettes)\/hooks\//;

export function analyzeSource( file, text ) {
  const imports = [];
  const violations = new Set();
  const record = ( node ) => { if ( typeof node?.value === 'string' ) imports.push( node.value ); };
  const rule = { create: () => ( {
    ImportDeclaration: ( node ) => record( node.source ),
    ExportNamedDeclaration: ( node ) => record( node.source ),
    ExportAllDeclaration: ( node ) => record( node.source ),
    ImportExpression: ( node ) => {
      if ( typeof node.source?.value !== 'string' ) throw new Error( 'Cannot audit a computed dynamic import' );
      record( node.source );
    },
    Identifier: ( node ) => {
      if ( ( sessionHook.test( file ) || sessionPolicy.test( file ) ) && node.name === 'chrome' ) {
        violations.add( file + ' accesses Chrome directly instead of an account adapter' );
      }
      if ( sessionHook.test( file ) && ['SESSION_KEY', 'PENDING_KEY', 'EPOCH_KEY'].includes( node.name ) ) {
        violations.add( file + ' knows session storage keys' );
      }
    },
    MemberExpression: ( node ) => {
      const name = node.computed ? node.property.value : node.property.name;
      if ( ( sessionHook.test( file ) || sessionPolicy.test( file ) ) && ['chrome', 'setAccessLevel'].includes( name ) ) {
        violations.add( file + ' accesses Chrome directly instead of an account adapter' );
      }
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
  return { imports, violations: [...violations] };
}
