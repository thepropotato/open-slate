import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/generated'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, chrome: 'readonly' },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Font Awesome is the app's only icon source, and it may only be reached
      // through the central registry in src/core/icons.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@fortawesome/*'],
              message:
                'Import icons from @/core/icons instead — Font Awesome is only wired up there.',
            },
          ],
        },
      ],

      // No emoji or decorative Unicode glyphs in the UI: use an Icon instead.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/[\\u{1F000}-\\u{1FAFF}\\u{2190}-\\u{21FF}\\u{2300}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{200D}]/u]',
          message: 'No emoji or symbol glyphs — use <Icon name="…" /> from @/core/icons.',
        },
        {
          selector: 'TemplateElement[value.raw=/[\\u{1F000}-\\u{1FAFF}\\u{2300}-\\u{27BF}\\u{FE0F}]/u]',
          message: 'No emoji or symbol glyphs — use <Icon name="…" /> from @/core/icons.',
        },
      ],
    },
  },
  {
    // The registry is the sanctioned exception.
    files: ['src/core/icons/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
