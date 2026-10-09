import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Preload the hashed UI and display fonts so they arrive with the CSS instead of after layout (production build only).
function preloadUiFont(): Plugin {
  return {
    name: 'penjat-preload-ui-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const fonts = Object.values(context.bundle ?? {}).filter((file) => /(?:penjat-ui|fraunces-latin)-variable-[\w-]+\.woff2$/.test(file.fileName))
        return fonts.map((font) => ({ tag: 'link', attrs: { rel: 'preload', href: `/${font.fileName}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadUiFont()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001' },
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true },
    },
  },
})
