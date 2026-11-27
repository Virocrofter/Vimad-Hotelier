import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      // React-Compiler diagnostics swept clean 2026-11-27 (89 findings cleared across
      // 8 batches). Compiler rules live in the js/jsx-scoped block below; the two
      // classic rules stay explicit here for every file type.
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'error',
      'no-useless-assignment': 'error',
      'react-refresh/only-export-components': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // React-Compiler diagnostics — swept clean 2026-11-27. incompatible-library and
    // invariant are deliberately NOT enabled (filed: compilation-skipped warnings /
    // compiler-internal, not fixable by us).
    files: ['**/*.{js,jsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/no-deriving-state-in-effects': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/exhaustive-effect-dependencies': 'error',
      'react-hooks/memo-dependencies': 'error',
      'react-hooks/preserve-manual-memoization': 'error',
      'react-hooks/unsupported-syntax': 'error',
      'react-hooks/static-components': 'error',
      'react-hooks/capitalized-calls': 'error',
      'react-hooks/component-hook-factories': 'error',
      'react-hooks/error-boundaries': 'error',
      'react-hooks/void-use-memo': 'error',
      'react-hooks/use-memo': 'error',
    },
  },
]);
