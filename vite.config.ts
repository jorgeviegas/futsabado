import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// No GitHub Pages o app fica em /<nome-do-repo>/ (definido via BASE_PATH no workflow).
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // service worker próprio (src/sw.ts): guarda o app e trata as notificações push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'FutSábado',
        short_name: 'FutSábado',
        description: 'Gerencie as peladas do FutSábado: presença, craque do jogo e financeiro.',
        lang: 'pt-BR',
        theme_color: '#3b0918',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        rollupFormat: 'iife', // service worker clássico (compatível com navegadores mais antigos)
      },
    }),
  ],
})
