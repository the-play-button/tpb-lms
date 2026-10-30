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
  // The SDK preset sets react.version to "detect" and carries Next's pages rule; this backend has neither React
  // nor pages, so both only print noise.
  { settings: { react: { version: '19.0' } }, rules: { '@next/next/no-html-link-for-pages': 'off' } },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // An empty query param / form field / claim means "absent" here (`?branch=` → 'main', empty email → sub):
      // `||` on a string is the intended fallback, `??` would keep ''. Numbers, booleans and objects stay judged.
      '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: { string: true } }],
      // Port methods return Promise by contract; in-memory adapters and test stubs implement them without an await,
      // and `async` keeps a throw a rejection for every implementation (same choice as tpb-commerce).
      '@typescript-eslint/require-await': 'off',
      // HTTP statuses, ports and counts in messages are numbers by nature (same option as tpb-commerce).
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowAny: false, allowBoolean: false, allowNullish: false, allowRegExp: false, allowNever: false }],
    },
  },
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
