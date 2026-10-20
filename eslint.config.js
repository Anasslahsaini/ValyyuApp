import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/coverage/**',
      'docs/**',
      '.superpowers/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.tsx'],
    extends: [eslintReact.configs['recommended-typescript']],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // User-facing copy lives in packages/i18n/locales: no literal strings in UI code.
    files: ['apps/**/*.tsx', 'packages/ui/**/*.tsx'],
    ignores: [
      '**/*.test.tsx',
      '**/__tests__/**',
      '**/__typetests__/**',
      'apps/mobile/src/catalog/**',
      'apps/mobile/app/dev/**',
    ],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: [
              'label',
              'title',
              'placeholder',
              'accessibilityLabel',
              'accessibilityHint',
              'help',
              'error',
              'unit',
            ],
          },
        },
      ],
    },
  },
  {
    // Logic imported from the first app (Valyyu-App), kept as-is with its 344 tests. Type-aware strict rules are
    // relaxed here until it is tightened module by module; new code elsewhere stays fully strict.
    files: ['packages/domain/**/*.{ts,mjs}', 'packages/life-data/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-useless-assignment': 'off',
    },
  },
  {
    // Testing Library types element props as any; reading props.style in assertions is intended.
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
