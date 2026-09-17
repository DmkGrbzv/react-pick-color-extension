import {
  GET_PALETTE,
  ADD_COLOR,
  REMOVE_COLOR,
  SAVE_GRADIENT,
  findCorrectMessageType,
} from '@/messageTypes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHex,
  normalizeGradient,
  gradientCss,
  gradientDeclaration,
  createGradientDraft,
  updateGradientDraft,
  gradientFromDraft,
  draftErrors,
  draftDirty,
} from '@/gradient.js';
import { createPaletteExecutor } from './helpers/palette.js';
import { isPalette } from '@/types.js';

function gradient( direction = 'right', first = 0, second = 100 ) {
  return {
    type: 'gradient',
    gradientType: 'linear',
    direction,
    stops: [
      { hex: '#000', position: first },
      { hex: '#fff', position: second },
    ],
  };
}

function service( initial = { id: 'current', name: 'My palette', colors: [] } ) {
  let palette = structuredClone( initial );
  let fail = false;
  let writes = 0;
  let id = 0;
  const storage = {
    async get() {
      return { currentPalette: structuredClone( palette ) };
    },
    async set( value ) {
      if ( fail ) {
        fail = false;
        throw new Error( 'Write failed' );
      }
      writes++;
      palette = structuredClone( value.currentPalette );
    },
  };
  return {
    execute: createPaletteExecutor( storage, () => 'new-' + ++id ),
    restart: () => createPaletteExecutor( storage ),
    failNextWrite: () => {
      fail = true;
    },
    writes: () => writes,
  };
}

test( 'opaque HEX supports both forms and rejects alpha, names, missing hash and malformed input', () => {
  assert.equal( normalizeHex( '#abc' ), '#AABBCC' );
  assert.equal( normalizeHex( ' #aBcDeF ' ), '#ABCDEF' );
  for ( const input of ['red', '123456', '#abcd', '#12345678', '#ggg', '', null] ) {
    assert.equal( normalizeHex( input ), null );
  }
} );

test( 'all four directions and stop positions share exact CSS output', () => {
  const cssDirections = { right: 'to right', left: 'to left', down: 'to bottom', up: 'to top' };
  for ( const [direction, cssDirection] of Object.entries( cssDirections ) ) {
    const value = gradient( direction, 30, 70 );
    const expected = `linear-gradient(${cssDirection}, #000000 30%, #FFFFFF 70%)`;
    assert.equal( gradientCss( value ), expected );
    assert.equal( gradientDeclaration( value ), 'background: ' + expected + ';' );
  }
  assert.equal(
    gradientCss( gradient( 'right', 50, 50 ) ),
    'linear-gradient(to right, #000000 50%, #FFFFFF 50%)'
  );
  assert.equal(
    gradientCss( gradient( 'up', 20, 30 ) ),
    'linear-gradient(to top, #000000 20%, #FFFFFF 30%)'
  );
} );

test( 'invalid positions/order/direction are rejected before storage or CSS generation', () => {
  for ( const [first, second] of [
    [80, 20],
    [-1, 100],
    [0, 101],
    ['', 100],
    [0.5, 100],
    [NaN, 100],
  ] ) {
    assert.throws( () => normalizeGradient( gradient( 'right', first, second ) ), {
      code: 'invalidGradient',
    } );
  }
  assert.throws( () => normalizeGradient( gradient( 'diagonal' ) ), { code: 'invalidGradient' } );
} );

test( 'draft changes are independent of saved objects and swap only changes the colors', () => {
  const saved = { id: 'gradient-1', ...normalizeGradient( gradient( 'left', 30, 70 ) ) };
  const original = structuredClone( saved );
  let draft = createGradientDraft( saved );
  assert.equal( draftDirty( draft ), false );
  draft = updateGradientDraft( draft, { type: 'swap' } );
  assert.deepEqual( draft.stops, [
    { hex: '#FFFFFF', position: '30' },
    { hex: '#000000', position: '70' },
  ] );
  assert.equal( draft.direction, 'left' );
  assert.equal( draft.id, 'gradient-1' );
  assert.equal( draftDirty( draft ), true );
  assert.deepEqual( saved, original );
  const output = gradientFromDraft( draft );
  assert.equal( output.id, 'gradient-1' );
  assert.ok( !( 'preview' in output ) && !( 'baseline' in output ) );
} );

test( 'invalid input keeps the last valid preview and blocks submission until corrected', () => {
  let draft = createGradientDraft();
  draft = updateGradientDraft( draft, { type: 'hex', index: 0, value: '#abc' } );
  const previous = gradientCss( draft.preview );
  draft = updateGradientDraft( draft, { type: 'hex', index: 0, value: '#oops' } );
  assert.equal( gradientCss( draft.preview ), previous );
  assert.equal( draftErrors( draft ).hex[0], true );
  assert.throws( () => gradientFromDraft( draft ), { code: 'invalidGradient' } );
  draft = updateGradientDraft( draft, { type: 'hex', index: 0, value: '#abc' } );
  draft = updateGradientDraft( draft, { type: 'position', index: 0, value: '101' } );
  assert.equal( gradientCss( draft.preview ), previous );
  assert.equal( draftErrors( draft ).invalid, true );
  draft = updateGradientDraft( draft, { type: 'position', index: 0, value: '30' } );
  draft = updateGradientDraft( draft, { type: 'position', index: 1, value: '70' } );
  assert.equal( draftErrors( draft ).invalid, false );
  assert.equal( gradientCss( draft.preview ), 'linear-gradient(to right, #AABBCC 30%, #FFFFFF 70%)' );
} );

test( 'sliders cannot cross; equal positions work and numeric errors remain visible', () => {
  let draft = createGradientDraft( { id: 'g', ...gradient( 'right', 30, 70 ) } );
  draft = updateGradientDraft( draft, { type: 'slider', index: 0, value: '90' } );
  assert.deepEqual(
    draft.stops.map( ( stop ) => stop.position ),
    ['70', '70']
  );
  draft = updateGradientDraft( draft, { type: 'slider', index: 1, value: '10' } );
  assert.deepEqual(
    draft.stops.map( ( stop ) => stop.position ),
    ['70', '70']
  );
  assert.equal( draftErrors( draft ).invalid, false );
  draft = updateGradientDraft( draft, { type: 'position', index: 0, value: '80' } );
  assert.equal( draftErrors( draft ).order, true );
  assert.equal( gradientCss( draft.preview ), 'linear-gradient(to right, #000000 70%, #FFFFFF 70%)' );
} );

test( 'draft initialization/reset is deterministic and does not write to palette storage', async () => {
  const backend = service();
  let draft = createGradientDraft();
  assert.equal( draft.id, null );
  assert.equal( draftDirty( draft ), false );
  assert.deepEqual( draft.stops, [
    { hex: '#000000', position: '0' },
    { hex: '#FFFFFF', position: '100' },
  ] );
  draft = updateGradientDraft( draft, { type: 'hex', index: 0, value: '#f00' } );
  assert.equal( backend.writes(), 0 );
  assert.deepEqual( ( await backend.execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors, [] );
  assert.equal( createGradientDraft().stops[0].hex, '#000000' );
  assert.equal( gradientFromDraft( draft ).stops[0].hex, '#FF0000' );
} );

test( 'gradient save adds one normalized item alongside legacy colors and survives restart', async () => {
  const legacy = { id: 'old', hex: '#ABCDEF' };
  const backend = service( { id: 'current', name: 'My palette', colors: [legacy] } );
  await backend.execute( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient: gradient( 'down', 30, 70 ) } );
  const restored = await backend.restart()( { type: findCorrectMessageType( GET_PALETTE ) } );
  assert.equal( backend.writes(), 1 );
  assert.equal( restored.colors.length, 2 );
  assert.deepEqual( restored.colors[0], legacy );
  assert.deepEqual( restored.colors[1], {
    id: 'new-1',
    ...normalizeGradient( gradient( 'down', 30, 70 ) ),
  } );
  assert.equal( isPalette( restored ), true );
  await backend.execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#abcdef' } );
  assert.equal( ( await backend.execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors.length, 2 );
} );

test( 'editing preserves id and concurrent unrelated additions and deletions are not lost', async () => {
  const original = { id: 'g', ...normalizeGradient( gradient() ) };
  const backend = service( {
    id: 'current',
    name: 'My palette',
    colors: [{ id: 'old', hex: '#123456' }, original],
  } );
  await Promise.all( [
    backend.execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#FF0000' } ),
    backend.execute( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient: { id: 'g', ...gradient( 'left', 50, 50 ) } } ),
    backend.execute( { type: findCorrectMessageType( REMOVE_COLOR ), id: 'old' } ),
  ] );
  const palette = await backend.execute( { type: findCorrectMessageType( GET_PALETTE ) } );
  assert.equal( palette.colors.length, 2 );
  assert.equal( palette.colors.filter( ( item ) => item.type === 'gradient' ).length, 1 );
  assert.equal( palette.colors.find( ( item ) => item.id === 'g' ).direction, 'left' );
  assert.ok( palette.colors.some( ( item ) => item.hex === '#FF0000' ) );
  await backend.execute( { type: findCorrectMessageType( REMOVE_COLOR ), id: 'g' } );
  assert.deepEqual( ( await backend.execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors, [
    { id: 'new-1', hex: '#FF0000' },
  ] );
} );

test( 'a deleted gradient is not resurrected by a stale editing draft', async () => {
  const backend = service();
  await assert.rejects(
    backend.execute( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient: { id: 'deleted', ...gradient() } } ),
    { code: 'gradientMissing' }
  );
  assert.equal( backend.writes(), 0 );
} );

test( 'failed save does not change persisted data or the submitted draft, and retry works', async () => {
  const backend = service();
  const draft = updateGradientDraft( createGradientDraft(), {
    type: 'hex',
    index: 0,
    value: '#abc',
  } );
  const before = structuredClone( draft );
  backend.failNextWrite();
  await assert.rejects(
    backend.execute( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient: gradientFromDraft( draft ) } ),
    /Write failed/
  );
  assert.deepEqual( draft, before );
  assert.deepEqual( ( await backend.execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors, [] );
  await backend.execute( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient: gradientFromDraft( draft ) } );
  assert.equal( ( await backend.execute( { type: findCorrectMessageType( GET_PALETTE ) } ) ).colors.length, 1 );
} );

test( 'invalid gradient commands never persist and leave queue usable', async () => {
  const backend = service();
  for ( const value of [
    null,
    gradient( 'right', 90, 10 ),
    { ...gradient(), stops: [] },
    { ...gradient(), gradientType: 'radial' },
  ] ) {
    await assert.rejects( backend.execute( { type: findCorrectMessageType( SAVE_GRADIENT ), gradient: value } ), {
      code: 'invalidGradient',
    } );
  }
  assert.equal( backend.writes(), 0 );
  await backend.execute( { type: findCorrectMessageType( ADD_COLOR ), hex: '#123456' } );
  assert.equal( backend.writes(), 1 );
} );

test( 'editing valid fields keeps working beside invalid inputs without mutating the previous draft', () => {
  const original = createGradientDraft( { id: 'g', ...gradient( 'right', 30, 70 ) } );
  const before = structuredClone( original );
  let draft = updateGradientDraft( original, { type: 'position', index: 1, value: '' } );
  draft = updateGradientDraft( draft, { type: 'slider', index: 0, value: '95' } );
  assert.equal( draft.stops[0].position, '70' );
  assert.equal( draft.stops[1].position, '' );
  assert.deepEqual( draft.preview.stops.map( ( stop ) => stop.position ), [30, 70] );
  draft = updateGradientDraft( draft, { type: 'hex', index: 0, value: '#bad-input' } );
  draft = updateGradientDraft( draft, { type: 'hex', index: 1, value: '#f00' } );
  draft = updateGradientDraft( draft, { type: 'direction', value: 'down' } );
  assert.equal( gradientCss( draft.preview ), 'linear-gradient(to bottom, #000000 30%, #FF0000 70%)' );
  assert.equal( draft.stops[0].hex, '#bad-input' );
  assert.equal( draftErrors( draft ).invalid, true );
  assert.deepEqual( original, before );
} );
