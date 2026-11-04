/**
 * @typedef {object} RateLimiter
 * @property {(scope:string, identity:string, maximum:number)=>Promise<void>} check
 * Atomically counts attempts in the current minute for a scope and identity.
 * Rejects with rateLimited above maximum. Cleanup cannot reset a live window.
 * Unexpected persistence errors reject instead of silently disabling the limit.
 */
export {};
