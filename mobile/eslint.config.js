// eslint-config-expo@~57 default export is a legacy-style object (extends/overrides/globals),
// not a flat config array. Wrap it with FlatCompat from @eslint/eslintrc.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
    ...compat.extends('eslint-config-expo'),
    {
        rules: {
            'import/order': [
                'error',
                {
                    groups: [
                        'builtin',
                        'external',
                        'internal',
                        'parent',
                        'sibling',
                        'index',
                    ],
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'import/consistent-type-specifier-style': [
                'error',
                'prefer-top-level',
            ],
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'separate-type-imports',
                },
            ],
        },
    },
    {
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            '@stylistic/brace-style': [
                'error',
                '1tbs',
                { allowSingleLine: false },
            ],
            '@stylistic/padding-line-between-statements': [
                'error',
                ...[
                    'if',
                    'return',
                    'for',
                    'while',
                    'do',
                    'switch',
                    'try',
                    'throw',
                ].flatMap((stmt) => [
                    { blankLine: 'always', prev: '*', next: stmt },
                    { blankLine: 'always', prev: stmt, next: '*' },
                ]),
            ],
        },
    },
    {
        ignores: [
            'node_modules',
            '.expo',
            'android',
            'ios',
            'dist',
            'web-build',
            'expo-env.d.ts',
        ],
    },
];
