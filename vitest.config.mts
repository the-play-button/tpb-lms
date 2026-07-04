import { defineConfig } from 'vitest/config';

// Self-contained config: no external `@the-play-button/tpb-sdk-vitest` preset
// (it was imported but never declared as a dependency, which made the suite
// unrunnable). No test in this repo uses the Cloudflare Workers pool, so the
// node environment is sufficient. `@the-play-button/tpb-sdk-js` resolves to the
// built package in node_modules.
export default defineConfig({
  test: {
    include: [
      'tests/**/*.{test,spec}.ts',
      'backend/**/*.{test,spec}.{ts,js}',
      'frontend-on-cf-worker/**/*.{test,spec}.{ts,js}',
    ],
    environment: 'node',
  },
});
