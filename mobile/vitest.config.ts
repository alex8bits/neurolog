import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(dirname, 'src'),
        },
    },
    test: {
        // Только настоящие юнит-тесты: gitignored-артефакты
        // (например, .smoke-logs/junk/metro.config.test.cjs) в discovery
        // попадать не должны.
        include: ['__tests__/**/*.test.ts'],
    },
});
