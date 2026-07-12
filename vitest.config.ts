import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
      },
      include: ['src/**'],
      exclude: [
        'node_modules',
        'src/**/*.test.ts',
        'src/runtime.ts',
        'src/env.d.ts',
      ],
    },
  },
});
