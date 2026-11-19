import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { defineConfig } from 'vitest/config'
import manifest from './manifest.json' with { type: 'json' }

export default defineConfig(({ mode }) => ({
  // crx resolves manifest entry points; unit tests don't need it
  plugins: [vue(), ...(mode === 'test' ? [] : [crx({ manifest })])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: 'src/tests/setup.ts',
    include: ['src/**/*.test.ts'],
  },
}))
