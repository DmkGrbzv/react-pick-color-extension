import { sendRequest } from '@/runtime/sendRequest.js';

const request = ( action, values = {} ) => sendRequest( { type: 'cloud:' + action, ...values } );
export const getCloudState = () => request( 'state' );
export const signIn = () => request( 'signIn' );
export const signOut = () => request( 'logout' );
export const prepareCloudSave = () => request( 'prepare' );
export const cancelCloudSave = () => request( 'cancelSave' );
export const nameCloudSave = ( key, name ) => request( 'nameSave', { key, name } );
export const saveCloudPalette = ( key ) => request( 'save', { key } );
export const listCloudPalettes = ( cursor ) => request( 'list', { cursor } );
export const getCloudPalette = ( id ) => request( 'get', { id } );
export const openCloudPalette = ( id, expectedVersion ) => request( 'open', { id, expectedVersion } );
export const renameCloudPalette = ( id, name ) => request( 'rename', { id, name } );
export const deleteCloudPalette = ( id ) => request( 'remove', { id } );
