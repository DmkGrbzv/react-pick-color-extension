import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const future = () => new Date( Date.now() + 60_000 );
const identity = { provider: 'https://identity.test', sub: 'subject', email: 'first@example.test' };

export function authRepositoryContract( label, factory ) {
  test( label + ': neutral detached users and concurrent identity upsert', async ( context ) => {
    const { auth } = await factory( context );
    const users = await Promise.all( Array.from( { length: 6 }, () => auth.findUser( identity ) ) );
    assert.equal( new Set( users.map( ( user ) => user.id ) ).size, 1 );
    assert.deepEqual( Object.keys( users[0] ).sort(), ['email', 'id', 'provider', 'sub'] );
    users[0].email = 'mutated';
    const updated = await auth.findUser( { ...identity, email: 'updated@example.test' } );
    assert.equal( updated.id, users[1].id );
    assert.equal( updated.email, 'updated@example.test' );
    assert.notEqual( ( await auth.findUser( { ...identity, provider: 'other' } ) ).id, updated.id );
  } );

  test( label + ': transactions and exchange codes are atomically consumed once', async ( context ) => {
    const { auth } = await factory( context );
    const transaction = { state: randomUUID(), nonce: 'nonce', providerVerifier: 'verifier',
      providerChallenge: 'challenge', challenge: 'client', clientState: 'state',
      redirectUri: 'https://extension.test/oauth', expiresAt: future() };
    const created = await auth.createTransaction( transaction );
    assert.equal( typeof created.id, 'string' );
    assert.equal( created._id, undefined );
    assert.ok( created.expiresAt instanceof Date );
    await assert.rejects( auth.createTransaction( transaction ), { code: 'operationConflict' } );
    created.nonce = 'mutated';
    const taken = await Promise.all( Array.from( { length: 6 }, () => auth.takeTransaction( transaction.state ) ) );
    assert.equal( taken.filter( Boolean ).length, 1 );
    assert.equal( taken.find( Boolean ).nonce, transaction.nonce );
    assert.equal( await auth.takeTransaction( 'missing' ), null );
    const exchange = { codeHash: randomUUID(), challenge: 'challenge', userId: 'user', email: null, expiresAt: future() };
    const code = await auth.createExchange( exchange );
    assert.equal( code._id, undefined );
    assert.equal( typeof code.id, 'string' );
    await assert.rejects( auth.createExchange( exchange ), { code: 'operationConflict' } );
    assert.equal( await auth.takeExchange( exchange.codeHash, 'wrong' ), null );
    const redeemed = await Promise.all( Array.from( { length: 6 }, () => auth.takeExchange( exchange.codeHash, exchange.challenge ) ) );
    assert.equal( redeemed.filter( Boolean ).length, 1 );
    assert.equal( redeemed.find( Boolean ).id, code.id );
  } );

  test( label + ': expiry and revocation are enforced without TTL cleanup', async ( context ) => {
    const { auth } = await factory( context );
    const user = await auth.findUser( identity );
    const tokenHash = randomUUID();
    const input = { tokenHash, userId: user.id, expiresAt: future() };
    const created = await auth.createSession( input );
    assert.equal( created._id, undefined );
    assert.equal( typeof created.id, 'string' );
    await assert.rejects( auth.createSession( input ), { code: 'operationConflict' } );
    const session = await auth.findSession( tokenHash );
    assert.deepEqual( session, { ...created, user } );
    session.user.email = 'mutated';
    assert.equal( ( await auth.findSession( tokenHash ) ).user.email, identity.email );
    assert.equal( await auth.revokeSession( tokenHash ), true );
    assert.equal( await auth.revokeSession( tokenHash ), false );
    assert.equal( await auth.findSession( tokenHash ), null );
    await auth.createSession( { ...input, expiresAt: new Date( 0 ) } );
    assert.equal( await auth.findSession( tokenHash ), null );
    await auth.createSession( { ...input, tokenHash: 'orphan', userId: 'absent' } );
    assert.equal( await auth.findSession( 'orphan' ), null );
    await auth.createTransaction( { state: 'expired', expiresAt: new Date( 0 ) } );
    await auth.createExchange( { codeHash: 'expired', challenge: 'challenge', expiresAt: new Date( 0 ) } );
    assert.equal( await auth.takeTransaction( 'expired' ), null );
    assert.equal( await auth.takeExchange( 'expired', 'challenge' ), null );
  } );
}
