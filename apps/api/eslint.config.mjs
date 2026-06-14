import baseConfig from '@bitecodes/config/eslint';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // NestJS uses classes with DI — allow empty constructors
      '@typescript-eslint/no-useless-constructor': 'off',
    },
  },
];
