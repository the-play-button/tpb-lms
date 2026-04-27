import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@the-play-button/tpb-sdk-js': path.resolve(__dirname, '../tpb-sdk/js/src/index.ts'),
    },
  },
});
