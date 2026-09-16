import stylistic from '@stylistic/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig( [
  globalIgnores( ['dist'] ),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, chrome: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }] },
  },
  { files: ['tests/**/*.js'], languageOptions: { globals: globals.node } },
  prettier,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/space-in-parens': ['error', 'always'],
      '@stylistic/jsx-curly-spacing': ['error', { when: 'always', attributes: true, children: true }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/eol-last': ['error', 'always'],
    },
  },
] );
