import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig( {
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel.html',
        editor: 'editor.html',
        background: 'src/background.js',
      },
      output: {
        entryFileNames: ( chunk ) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
} );
