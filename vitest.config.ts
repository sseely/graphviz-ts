// SPDX-License-Identifier: EPL-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    includeSource: ['test/**/*.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/parser/dot.js',
        'src/parser/dot.d.ts',
        'src/**/__fixtures__/**',
      ],
      reporter: ['text', 'json-summary'],
    },
  },
});
