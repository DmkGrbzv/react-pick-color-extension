/**
 * Entities use opaque string ids and UTC Date values rounded to milliseconds.
 * Ordering is createdAt descending, then id descending in binary ASCII order.
 * Generated ids are canonical lowercase UUID strings. Pagination is exclusive:
 * a continuation selects records strictly below that (createdAt, id) pair.
 * Returned data is detached. Infrastructure failures reject, never return empty success.
 *
 * @typedef {{type:'color', hex:string}} ColorItem
 * @typedef {{hex:string, position:number}} GradientStop
 * @typedef {{type:'gradient', gradientType:'linear', direction:'right'|'left'|'down'|'up',
 * stops:[GradientStop,GradientStop]}} GradientItem
 * @typedef {{name:string, items:Array<ColorItem|GradientItem>}} PaletteSnapshot
 * Inputs are validated/normalized by the service: uppercase #RRGGBB, trimmed
 * nonblank name, ordered stops in [0,100], supported item kinds, bounded count.
 * @typedef {PaletteSnapshot & {id:string, ownerId:string, createdAt:Date}} StoredPalette
 * @typedef {{createdAt:Date, id:string}} PalettePosition
 * @typedef {{palettes:StoredPalette[], continuation:PalettePosition|null}} PalettePage
 * @typedef {{ownerId:string, key:string, snapshot:PaletteSnapshot, payloadHash:string, maximum:number}} CreatePalette
 * @typedef {object} PaletteRepository
 * @property {(input:CreatePalette)=>Promise<{palette:StoredPalette, created:boolean}>} create
 * Atomically persists the palette and increments its owner's quota. Same owner/key/hash
 * returns the existing record with created=false, even when quota is full. Different
 * content rejects with saveConflict; a deleted key rejects with snapshotDeleted;
 * missing owner or exhausted quota rejects with paletteLimit. Concurrent creates
 * cannot exceed maximum. Creation and deletion must serialize quota changes.
 * @property {(ownerId:string, page:{cursor:PalettePosition|null, limit:number})=>Promise<PalettePage>} list
 * Only active records of this owner. Empty page is {palettes:[], continuation:null}.
 * Returns a continuation only when another record exists. No externally encoded cursor.
 * @property {(ownerId:string, id:string)=>Promise<StoredPalette|null>} find
 * Null for missing, foreign or deleted records.
 * @property {(ownerId:string, id:string, name:string)=>Promise<StoredPalette|null>} rename
 * Atomic metadata change, preserving original idempotency receipt; null if inaccessible.
 * @property {(ownerId:string, id:string)=>Promise<boolean>} remove
 * Content removal and decrement of quota are atomic. True also for repeated deletion
 * of the owner's record; false for missing/foreign id. Retains a receipt so old keys
 * cannot recreate deleted content. Inconsistent quota rejects with serverError and
 * rolls back the complete removal.
 */
export {};
