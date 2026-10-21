import { sendRequest } from '@/extension/messaging/sendRequest.js';

const request = ( action, values = {} ) => sendRequest( { type: 'cloud:' + action, ...values } );
export const getLibraryState = () => request( 'state' );
export const signIn = () => request( 'signIn' );
export const signOut = () => request( 'logout' );
export const preparePaletteSave = () => request( 'prepare' );
export const cancelPaletteSave = () => request( 'cancelSave' );
export const namePaletteSave = ( key, name ) => request( 'nameSave', { key, name } );
export const savePaletteSnapshot = ( key ) => request( 'save', { key } );
export const listSavedPalettes = ( cursor ) => request( 'list', { cursor } );
export const getSavedPalette = ( id ) => request( 'get', { id } );
export const openSavedPalette = ( id, expectedVersion ) => request( 'open', { id, expectedVersion } );
export const renameSavedPalette = ( id, name ) => request( 'rename', { id, name } );
export const deleteSavedPalette = ( id ) => request( 'remove', { id } );
