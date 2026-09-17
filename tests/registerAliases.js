import { registerHooks } from 'node:module';

// Node tests do not use Vite's resolver.
registerHooks( {
  resolve( specifier, context, nextResolve ) {
    const target = specifier.startsWith( '@/' )
      ? new URL( '../src/' + specifier.slice( 2 ), import.meta.url ).href
      : specifier;
    return nextResolve( target, context );
  },
} );
