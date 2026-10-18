import express from 'express';
import helmet from 'helmet';
import { ApiError } from './http/apiError.js';
import { authenticate, corsPolicy, errorResponse, rateLimit, requestContext } from './http/middleware.js';

function authRoutes( auth, limiter ) {
  const router = express.Router();
  router.use( rateLimit( limiter, 'auth', 20 ) );
  router.post( '/start', async ( request, response ) => {
    response.json( await auth.begin( request.body ) );
  } );
  router.get( '/callback', async ( request, response ) => {
    response.redirect( 302, await auth.callback( request.query ) );
  } );
  router.post( '/exchange', async ( request, response ) => {
    response.json( await auth.exchange( request.body ) );
  } );
  router.post( '/logout', authenticate( auth ), async ( request, response ) => {
    await auth.logout( request.session );
    response.sendStatus( 204 );
  } );
  return router;
}

function paletteRoutes( palettes, limiter ) {
  const router = express.Router();
  router.get( '/', async ( request, response ) => {
    response.json( await palettes.list( request.session.userId, request.query ) );
  } );
  router.get( '/:id', async ( request, response ) => {
    response.json( await palettes.get( request.session.userId, request.params.id ) );
  } );
  router.post( '/', rateLimit( limiter, 'write', 20 ), async ( request, response ) => {
    const result = await palettes.save( request.session.userId, request.body, request.get( 'Idempotency-Key' ) );
    response.status( result.created ? 201 : 200 ).json( result.palette );
  } );
  router.patch( '/:id', rateLimit( limiter, 'write', 20 ), async ( request, response ) => {
    response.json( await palettes.rename( request.session.userId, request.params.id, request.body ) );
  } );
  router.delete( '/:id', rateLimit( limiter, 'write', 20 ), async ( request, response ) => {
    await palettes.remove( request.session.userId, request.params.id );
    response.sendStatus( 204 );
  } );
  return router;
}

export function createApp( { config, auth, palettes, limiter } ) {
  const app = express();
  app.disable( 'x-powered-by' );
  app.set( 'trust proxy', config.proxyHops );
  app.use( helmet(), requestContext, corsPolicy( config ), express.json( { limit: '32kb', strict: true } ) );
  app.get( '/health', ( request, response ) => response.json( { status: 'ok' } ) );
  app.use( '/v1/auth', authRoutes( auth, limiter ) );
  app.use( '/v1', authenticate( auth ), rateLimit( limiter, 'api', 120 ) );
  app.get( '/v1/me', ( request, response ) => response.json( {
    id: request.session.userId, email: request.session.user.email,
    expiresAt: request.session.expiresAt,
  } ) );
  app.use( '/v1/palettes', paletteRoutes( palettes, limiter ) );
  app.use( () => { throw new ApiError( 404, 'notFound' ); } );
  app.use( errorResponse );
  return app;
}
