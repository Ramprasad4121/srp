import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      'node:fs/promises': resolve(__dirname, 'src/stubs/node-fs-stub.ts'),
      'node:path': resolve(__dirname, 'src/stubs/node-path-stub.ts'),
    }
  },
  build: {
    outDir: 'dist-web',
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
