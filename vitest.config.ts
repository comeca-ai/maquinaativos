import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@maquina/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@maquina/kits': fileURLToPath(new URL('./packages/kits/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'products/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
