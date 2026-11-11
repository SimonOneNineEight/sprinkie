const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');
const reactNative = require('eslint-plugin-react-native');

module.exports = defineConfig([
  expoConfig,
  {
    plugins: { 'react-native': reactNative },
    rules: {
      // The token brand (src/theme/createStyles.ts) already makes hardcoded
      // colors a type error inside createStyles; this rule is the backstop
      // for the escape hatches types can't see: inline style props and plain
      // StyleSheet.create.
      'react-native/no-color-literals': 'error',
      // react-native/no-inline-styles stays off on purpose: data-driven token
      // styles (category dot colors) are idiomatic here, and the color
      // discipline is carried by the brand plus no-color-literals.
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { i18next },
    rules: {
      // String-catalog discipline: user-facing JSX text lives in the
      // src/i18n catalogs, never inline.
      'i18next/no-literal-string': 'error',
    },
  },
  {
    // Tests assert on the zh-TW catalog literals themselves, so the catalog
    // rule does not apply to them.
    files: ['**/*.test.{ts,tsx}'],
    rules: { 'i18next/no-literal-string': 'off' },
  },
  {
    // No wall-clock waits (#138 retro): a raised timeout passes on a fast
    // laptop and times out on CI. Time-driven behavior runs on fake timers.
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          "CallExpression:matches([callee.name=/^(find(All)?By|waitFor)/], [callee.property.name=/^(find(All)?By|waitFor)/]) > ObjectExpression > Property[key.name='timeout']",
          "CallExpression[callee.object.name='jest'][callee.property.name='setTimeout']",
          "CallExpression:matches([callee.name=/^[fx]?(it|test)$/], [callee.object.name=/^(it|test)$/], [callee.callee.object.name=/^(it|test)$/], [callee.tag.object.name=/^(it|test)$/])[arguments.length=3]",
          'CallExpression[callee.name=/^(before|after)(Each|All)$/][arguments.length=2]',
        ].map((selector) => ({
          selector,
          message:
            'Drive time with Jest fake timers (jest.useFakeTimers + advanceTimersByTimeAsync) instead of a timeout: real-time waits pass locally and time out on CI.',
        })),
      ],
    },
  },
  {
    // App Language discipline (#33): the catalog is reached only through
    // useStrings, so a language switch re-renders everything. A direct
    // import would freeze that consumer on zh-TW.
    files: ['src/**', 'App.tsx'],
    ignores: ['src/i18n/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/i18n/strings', '**/i18n/strings.en'],
              message: 'Read strings via useStrings() (src/i18n/AppLanguageProvider).',
            },
          ],
        },
      ],
    },
  },
  {
    // The jest setup file runs inside the test framework, not the app.
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly', require: 'readonly' } },
  },
  {
    ignores: ['src/api/types.gen.ts', 'src/theme/theme.gen.ts', '.expo/**'],
  },
]);
