import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js (CommonJS) references the Node global `global`, which does not exist
  // in browsers and made the whole app render a blank page. Alias it to the standard `globalThis`
  // for both the dev dependency pre-bundle and the production build.
  define: { global: 'globalThis' },
  optimizeDeps: { esbuildOptions: { define: { global: 'globalThis' } } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
