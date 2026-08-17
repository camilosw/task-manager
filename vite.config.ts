/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // No test files exist yet at this stage of scaffolding (they are added
    // section by section per tasks.md); do not treat that as a failure.
    passWithNoTests: true,
  },
})
