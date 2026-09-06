import { describe, expect, it } from 'vitest';

import { resolveReturnTo } from '@/auth/returnTo';

describe('resolveReturnTo', () => {
    it('валидное значение из белого списка возвращает как есть', () => {
        expect(resolveReturnTo('/quick')).toBe('/quick');
    });

    it('undefined и пустая строка → корень', () => {
        expect(resolveReturnTo(undefined)).toBe('/');
        expect(resolveReturnTo('')).toBe('/');
    });

    it('посторонние пути → корень', () => {
        expect(resolveReturnTo('/evil')).toBe('/');
        expect(resolveReturnTo('/(journal)')).toBe('/');
    });

    it('массив от повторённого query-параметра → корень', () => {
        expect(resolveReturnTo(['/quick'])).toBe('/');
        expect(resolveReturnTo(['/quick', '/evil'])).toBe('/');
    });
});
