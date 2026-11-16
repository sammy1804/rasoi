import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

/**
 * Two targets:
 *  - `npm run build`        → dist/            normal web app (deploy anywhere, SPA fallback)
 *  - `npm run build:mobile` → dist-mobile/     one self-contained index.html (JS, CSS and fonts
 *                                               inlined) published as the claude.ai link you open on your phone
 */
export default defineConfig(({ mode }) => {
  const mobile = mode === 'artifact'

  // The hosted page pads itself for the phone's notch/home bar via env(), so
  // drop the host's extra top/bottom padding and the web-app-only tags.
  const mobileHtml: Plugin = {
    name: 'rasoi-mobile-html',
    transformIndexHtml: (html) =>
      html
        .replace(/\s*<link rel="manifest"[^>]*>/, '')
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
        .replace(/\s*<link rel="icon"[^>]*>/, '')
        .replace('</title>', '</title>\n    <style>:root{padding-top:0!important;padding-bottom:0!important}</style>'),
  }

  return {
    base: './',
    plugins: mobile ? [react(), mobileHtml, viteSingleFile()] : [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { host: true, port: 5173 },
    build: mobile
      ? { outDir: 'dist-mobile', assetsInlineLimit: 100_000_000, cssCodeSplit: false }
      : {
          rollupOptions: {
            output: {
              manualChunks: {
                react: ['react', 'react-dom', 'react-router-dom'],
                motion: ['framer-motion'],
                ui: ['vaul', 'lucide-react'],
              },
            },
          },
        },
  }
})
