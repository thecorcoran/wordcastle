import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@word-castle/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    globals: false,
  },
});
