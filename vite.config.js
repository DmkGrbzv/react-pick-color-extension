import manifest from './public/manifest.json' with { type: 'json' };
import { EXTENSION_PAGES } from './src/constants/extensionPages.js';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { apiManifest, apiManifestPlugin } from './scripts/apiManifest.js';
import react from '@vitejs/plugin-react';

export default defineConfig( ( { mode } ) => ( {
  plugins: [react(), apiManifestPlugin( apiManifest( manifest,
    loadEnv( mode, '.', 'VITE_' ).VITE_PALETTE_API_URL || '' ) )],
  resolve: { alias: { '@': fileURLToPath( new URL( './src', import.meta.url ) ) } },
  base: './',
  build: {
    // Match the supported browser instead of shipping compatibility code for other engines.
    target: 'chrome' + manifest.minimum_chrome_version,
    modulePreload: { polyfill: false },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: EXTENSION_PAGES.SIDE_PANEL,
        editor: EXTENSION_PAGES.EDITOR,
        print: EXTENSION_PAGES.PRINT,
        library: EXTENSION_PAGES.LIBRARY,
        background: 'src/extension/background.js',
      },
      output: {
        entryFileNames: ( chunk ) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
} ) );
