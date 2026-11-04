/**
 * All dates are UTC instants with millisecond precision. Returned objects are
 * detached values. An absent or expired record is null, never a driver result.
 * Unexpected persistence failures reject; they must not look like missing data.
 *
 * @typedef {{id:string, provider:string, sub:string, email:string|null}} User
 * @typedef {{state:string, nonce:string, providerVerifier:string, providerChallenge:string,
 * challenge:string, clientState:string, redirectUri:string, expiresAt:Date}} LoginTransactionInput
 * @typedef {LoginTransactionInput & {id:string}} LoginTransaction
 * @typedef {{codeHash:string, challenge:string, userId:string, email:string|null, expiresAt:Date}} ExchangeInput
 * @typedef {ExchangeInput & {id:string}} LoginExchange
 * @typedef {{tokenHash:string, userId:string, expiresAt:Date}} SessionInput
 * @typedef {SessionInput & {id:string}} Session
 * @typedef {Session & {user:User}} AuthenticatedSession
 *
 * @typedef {object} AuthRepository
 * @property {(value:LoginTransactionInput)=>Promise<LoginTransaction>} createTransaction
 * Inserts one transaction; a duplicate state rejects with operationConflict.
 * @property {(state:string)=>Promise<LoginTransaction|null>} takeTransaction
 * Atomically consumes an unexpired transaction. Concurrent callers get it at most once.
 * @property {(value:ExchangeInput)=>Promise<LoginExchange>} createExchange
 * Inserts a code; a duplicate code hash rejects with operationConflict.
 * @property {(hash:string, challenge:string)=>Promise<LoginExchange|null>} takeExchange
 * Atomically consumes an unexpired matching code once. A wrong challenge does not consume it.
 * @property {(identity:import('./identityProvider.js').Identity)=>Promise<User>} findUser
 * Atomic upsert by provider + subject, including email refresh. Concurrent calls return one id.
 * @property {(value:SessionInput)=>Promise<Session>} createSession
 * Persists a session; duplicate token hash rejects with operationConflict.
 * @property {(hash:string)=>Promise<AuthenticatedSession|null>} findSession
 * Only returns an unexpired session whose user still exists, independent of cleanup timing.
 * @property {(hash:string)=>Promise<boolean>} revokeSession
 * Atomic revocation; true if removed, false if absent. Repeats are harmless.
 */
export {};
