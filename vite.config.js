import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH = "/<repo-name>/" bei GitHub Pages (wird im Workflow gesetzt), sonst "/"
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/wappen.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Trainingsliste TSV Öschelbronn',
        short_name: 'Training',
        description: 'Anwesenheit, P-Übungen und Vereinsmeisterschaft',
        lang: 'de',
        theme_color: '#164194',
        background_color: '#F3F4F6',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
