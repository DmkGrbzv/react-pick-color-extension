/**
 * @typedef {{provider:string, sub:string, email?:string}} Identity
 * Provider and subject identify the account. Email is optional verified metadata.
 * @typedef {object} IdentityProvider
 * @property {(transaction:import('./authRepository.js').LoginTransactionInput)=>string} authorizeUrl
 * Produces an authorization URL bound to state, nonce and the provider challenge.
 * @property {(query:Object<string,string>, transaction:import('./authRepository.js').LoginTransactionInput)=>Promise<Identity>} verify
 * Verifies identity, signature, issuer, audience, state, nonce and code binding.
 * Rejects with invalidIdentity or authConfiguration; never exposes provider secrets.
 */
export {};
