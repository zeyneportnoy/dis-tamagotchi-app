const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  // Global ignore: must be its own object (no other keys) to apply repo-wide.
  // The Supabase Edge Function is Deno code with remote imports — not part of the app build.
  { ignores: ['dist/**', 'coverage/**', 'supabase/functions/**'] },
  expoConfig,
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAnyKeyword',
          message: 'Use a precise type; any requires a documented exception.',
        },
      ],
    },
  },
]);
