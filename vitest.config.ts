// SPDX-License-Identifier: EPL-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
