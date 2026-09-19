import manifest from './public/manifest.json' with { type: 'json' };
import { EXTENSION_PAGES } from './src/constants/extensionPages.js';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig( {
  plugins: [react()],
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
        background: 'src/background.js',
      },
      output: {
        entryFileNames: ( chunk ) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
} );
