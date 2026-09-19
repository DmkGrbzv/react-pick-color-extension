export const THEMES = Object.freeze( {
  LIGHT: 'light',
  DARK: 'dark',
} );

export const THEME_KEY = 'theme';

export function normalizeTheme( value ) {
  return Object.values( THEMES ).includes( value ) ? value : THEMES.LIGHT;
}
