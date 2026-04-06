const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const simpleImportSortPlugin = require('eslint-plugin-simple-import-sort');
const sortDestructureKeysPlugin = require('eslint-plugin-sort-destructure-keys');
const perfectionistPlugin = require('eslint-plugin-perfectionist');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '*.json',
      '**/*config.js',
      '**/__tests__/*',
      '**/*.test.ts',
      'jest.setup.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'simple-import-sort': simpleImportSortPlugin,
      'sort-destructure-keys': sortDestructureKeysPlugin,
      'perfectionist': perfectionistPlugin,
    },
    rules: {
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-use-before-define': 'off',
      'no-unused-vars': 'off',
      'no-duplicate-imports': [
        'warn',
        {
          includeExports: true,
        },
      ],
      'object-shorthand': ['warn', 'always'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'sort-imports': 'off',
      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            ['^node:', '^@?\\w'],
            ['^(src|@)/'],
            ['^\\u0000'],
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'warn',
      'sort-destructure-keys/sort-destructure-keys': 'warn',
      'perfectionist/sort-objects': [
        'warn',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
        },
      ],
    },
  },
];
