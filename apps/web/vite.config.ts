import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext'
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:6969'
    }
  }
});
