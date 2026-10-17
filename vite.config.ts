/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative asset paths keep the build portable (Vercel, Capacitor's webDir, any static host).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'board.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Social Dart',
        short_name: 'Social Dart',
        description: 'Darts scorer for the pub and the garage: 501, 301, Killer, 1 to 7, Cricket, Close Out, Around the Clock. No sign-ups.',
        id: '/',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0c0b0a',
        theme_color: '#0c0b0a',
        categories: ['games', 'sports', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
