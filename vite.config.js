import { EXTENSION_PAGES } from './src/constants/extensionPages.js';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig( {
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath( new URL( './src', import.meta.url ) ) } },
  base: './',
  build: {
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
