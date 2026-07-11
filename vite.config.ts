import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    host: '127.0.0.1',
  },
  preview: {
    port: 4174,
    host: '127.0.0.1',
  },
});
