import {defineConfig} from 'vite';

// GitHub Pages serves this project from /DXTag-Web/, so the default base is the
// repository name. Override with VITE_BASE for a user page or a custom domain.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/DXTag-Web/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  worker: {format: 'es'},
  server: {port: 5173},
});
