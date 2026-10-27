import { defineConfig } from 'vite';

// Relative base so the built site works from any GitHub Pages sub-path (https://user.github.io/repo/).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
