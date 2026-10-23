import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' keeps every asset path relative, so the build works on GitHub Pages
// whatever the repo is called, and also when opened from a sub-folder.
export default defineConfig({
  base: './',
  plugins: process.env.SINGLE ? [viteSingleFile()] : [],
  build: { target: 'es2020', sourcemap: false },
});
