import test from 'node:test';
import assert from 'node:assert/strict';
import { PaletteService } from '@/features/palette/services/paletteService.js';
import { dispatchMessage } from '@/extension/messaging/dispatchMessage.js';

test( 'queued moves preserve 100 items, gradients and relative order', async () => {
  const colors = Array.from( { length: 100 }, ( _, id ) => ( { id: String( id ), hex: '#123456' } ) );
  colors[50] = { id: '50', type: 'gradient', gradientType: 'linear', direction: 'right',
    stops: [{ hex: '#112233', position: 0 }, { hex: '#FFFFFF', position: 100 }] };
  let stored = { id: 'current', name: 'Test', colors };
  let writes = 0;
  const paletteService = new PaletteService( {
    read: async () => structuredClone( stored ),
    write: async ( value ) => { writes++; stored = structuredClone( value ); },
  } );
  await Promise.all( ['50', '99', '12'].map( ( id ) =>
    dispatchMessage( { paletteService }, { type: 'palette:moveFirst', id } ) ) );
  assert.deepEqual( stored.colors.map( ( item ) => item.id ),
    ['12', '99', '50', ...colors.filter( ( item ) => !['12', '99', '50'].includes( item.id ) ).map( ( item ) => item.id )] );
  for ( const item of colors ) assert.deepEqual( stored.colors.find( ( value ) => value.id === item.id ), item );
  await paletteService.moveItemFirst( '12' );
  assert.equal( writes, 3 );
  await assert.rejects( paletteService.moveItemFirst( 'missing' ), { code: 'missingColor' } );
  assert.equal( stored.colors.length, 100 );
} );
