import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.serverless/', '.esbuild/', 'node_modules/'] },
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
