import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
  build: { outDir: '../dist/web', emptyOutDir: true },
});
