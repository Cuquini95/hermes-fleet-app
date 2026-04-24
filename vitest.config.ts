import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/sw.ts',
        'node_modules/**',
        'dist/**',
      ],
      thresholds: {
        // Per-file thresholds on the well-tested lib modules
        'src/lib/ot-generator.ts': { statements: 80, functions: 80, lines: 80, branches: 70 },
        'src/lib/priority-calculator.ts': { statements: 90, functions: 90, lines: 90, branches: 90 },
        'src/lib/date-utils.ts': { statements: 80, functions: 80, lines: 80, branches: 60 },
        'src/lib/data-adapter.ts': { statements: 80, functions: 80, lines: 80, branches: 70 },
        // Stores we covered
        'src/stores/cart-store.ts': { statements: 95, functions: 95, lines: 95, branches: 80 },
        'src/stores/equipment-store.ts': { statements: 90, functions: 90, lines: 90, branches: 60 },
        'src/stores/workorder-store.ts': { statements: 55, functions: 50, lines: 55, branches: 40 },
      },
    },
  },
});
