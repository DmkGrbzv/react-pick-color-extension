import { normalizeGradient } from '@/gradient.js';

/**
 * @typedef {{ id: string, hex: string, type?: 'color' }} SavedColor
 * @typedef {{ hex: string, position: number }} GradientStop
 * @typedef {{ id: string, type: 'gradient', gradientType: 'linear', direction: 'right'|'left'|'down'|'up', stops: GradientStop[] }} SavedGradient
 * @typedef {{ id: string, name: string, colors: (SavedColor|SavedGradient)[] }} Palette
 */

export const PALETTE_KEY = 'currentPalette';

/** @returns {Palette} */
export function createEmptyPalette() {
  return { id: 'current', name: 'My palette', colors: [] };
}

export function isPalette( value ) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray( value.colors ) &&
    value.colors.every( ( item ) => {
      if ( !item || typeof item.id !== 'string' ) return false;
      if ( item.type === 'gradient' ) {
        try {
          normalizeGradient( item );
          return true;
        } catch {
          return false;
        }
      }
      return (
        ( item.type === undefined || item.type === 'color' ) &&
        typeof item.hex === 'string' &&
        /^#[\da-f]{6}$/i.test( item.hex )
      );
    } )
  );
}
