import path from 'path';

import { defineConfig, mergeConfig } from 'vitest/config';
import preset from '@the-play-button/tpb-sdk-vitest/worker';

export default mergeConfig(preset, defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@the-play-button/tpb-sdk-js': path.resolve(__dirname, '../tpb-sdk/js/src/index.ts'),
    },
  },
}));
