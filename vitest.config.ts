import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
