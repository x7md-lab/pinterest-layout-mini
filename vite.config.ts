import { copyFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages serves static files only, so a deep link like /pin/3 would 404
 * before the router ever boots. Pages falls back to 404.html, so shipping a
 * copy of index.html under that name makes client-side routes resolve.
 */
function spaFallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      copyFileSync('dist/index.html', 'dist/404.html')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // '/' for dev + local builds; CI sets BASE_PATH for the GitHub Pages subpath.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
