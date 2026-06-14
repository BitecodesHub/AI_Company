import baseConfig from '@bitecodes/config/eslint';

export default [
  ...baseConfig,
  {
    files: ['**/*.tsx'],
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
];
