/**
 * Session policy depends on lifetimes, not browser storage areas.
 * initialize() restricts credential access before policy operations begin.
 * Reads return keyed records (absent keys are omitted); writes merge records.
 * All methods resolve after persistence or reject on failure. No silent fallback.
 * A single SessionStore serializes mutations, including read/check/write sequences;
 * the adapter must not reorder its awaited writes. It is not a cross-process lock.
 * Persistent data survives browser restart; temporary data survives worker restart
 * but expires with the browser session. Values must be structured-cloneable.
 *
 * @typedef {object} SessionStorage
 * @property {function(): Promise<unknown>} initialize
 * @property {function(string): Promise<object>} readPersistent
 * @property {function(object): Promise<void>} writePersistent
 * @property {function(string): Promise<void>} removePersistent
 * @property {function(string): Promise<object>} readTemporary
 * @property {function(object): Promise<void>} writeTemporary
 * @property {function(string): Promise<void>} removeTemporary
 */
export {};
