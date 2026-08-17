import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Must be last so it can disable any stylistic rule above that would
      // otherwise fight Prettier's formatting.
      eslintConfigPrettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Import-boundary rule: the domain layer is plain, dependency-free
    // TypeScript (see design.md, decision 1). It must never import React or
    // any storage API, whether a package or a browser storage global.
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message:
                'The domain layer must be plain TypeScript and must not import React (see design.md, decision 1).',
            },
            {
              group: [
                'idb',
                'idb-keyval',
                'dexie',
                'localforage',
                'fake-indexeddb',
                'fake-indexeddb/*',
                '**/persistence/*',
                '**/persistence',
              ],
              message:
                'The domain layer must not import a storage API or the persistence layer (see design.md, decision 1).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'indexedDB',
          message: 'The domain layer must not use a storage API.',
        },
        {
          name: 'localStorage',
          message: 'The domain layer must not use a storage API.',
        },
        {
          name: 'sessionStorage',
          message: 'The domain layer must not use a storage API.',
        },
        {
          name: 'caches',
          message: 'The domain layer must not use a storage API.',
        },
        {
          name: 'openDatabase',
          message: 'The domain layer must not use a storage API.',
        },
      ],
    },
  },
])
