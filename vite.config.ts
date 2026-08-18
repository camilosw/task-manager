/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Offline-first installable PWA (see design.md, decision 5 and 9, and
    // specs/offline-storage/spec.md, "The application is installable" /
    // "works without a network connection"). `generateSW` (the default
    // strategy) precaches the built application shell — JS, CSS, HTML, and
    // the icons below — with no hand-written service worker.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Task Manager',
        short_name: 'Task Manager',
        description:
          'A personal task manager built around a bounded, frozen daily plan.',
        theme_color: '#1E1B4B',
        background_color: '#1E1B4B',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // No test files exist yet at this stage of scaffolding (they are added
    // section by section per tasks.md); do not treat that as a failure.
    passWithNoTests: true,
  },
})
