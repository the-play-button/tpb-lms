import sdkPreset from '@the-play-button/tpb-sdk-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

// Type-aware lint for the backend TS source. The TPB preset embeds
// tseslint strictTypeChecked + projectService (auto-discovers backend/tsconfig.json).
export default [
  {
    ignores: [
      'frontend-on-cf-worker/**', // plain browser JS, no tsconfig (not type-aware)
      'node_modules/**',
      '**/dist/**',
      '**/.wrangler/**',
      '**/coverage/**',
      'db/**',
      // Entry point + config + middleware live outside backend/tsconfig.json's
      // reachable set (looser-typed, not import-reached from lms/services/handlers).
      // Type-aware lint needs project coverage; these join when they're brought
      // into the tsconfig during the TS-max lint-zero phase.
      'backend/index.ts',
      'backend/config.ts',
      'backend/config/**',
      'backend/middleware/**',
    ],
  },
  ...sdkPreset,
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // The SDK preset configures @typescript-eslint/no-unused-vars; layer the
      // unused-imports plugin for mechanical auto-removal (^_ allowlist honored).
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
