import { describe, expect, it } from 'vitest';

import { isCustomRangeValid, periodToRange } from '@/utils/period';

describe('periodToRange', () => {
    it('all → null: параметры from/to не шлются вовсе', () => {
        expect(
            periodToRange({ kind: 'all' }, new Date(2026, 6, 10)),
        ).toBeNull();
    });

    it('today → один и тот же день в from и to', () => {
        expect(periodToRange({ kind: 'today' }, new Date(2026, 6, 10))).toEqual(
            {
                from: '2026-07-10',
                to: '2026-07-10',
            },
        );
    });

    it('last7 в середине месяца: 7 включительных дней, to — сегодня', () => {
        expect(periodToRange({ kind: 'last7' }, new Date(2026, 6, 10))).toEqual(
            {
                from: '2026-07-04',
                to: '2026-07-10',
            },
        );
    });

    it('last7 через границу месяца: 2 июля уходит в 26 июня', () => {
        const range = periodToRange({ kind: 'last7' }, new Date(2026, 6, 2));

        expect(range).toEqual({ from: '2026-06-26', to: '2026-07-02' });
    });

    it('last7 через границу года: 2 января 2027 → 27 декабря 2026', () => {
        const range = periodToRange({ kind: 'last7' }, new Date(2027, 0, 2));

        expect(range).toEqual({ from: '2026-12-27', to: '2027-01-02' });
    });

    it('last30: 30 включительных дней, from в предыдущем месяце', () => {
        const range = periodToRange({ kind: 'last30' }, new Date(2026, 6, 10));

        expect(range).toEqual({ from: '2026-06-11', to: '2026-07-10' });
    });

    it('custom проходится как есть, равные даты не трогаются', () => {
        const period = {
            kind: 'custom',
            from: '2026-01-01',
            to: '2026-01-01',
        } as const;

        expect(periodToRange(period, new Date(2026, 6, 10))).toEqual({
            from: '2026-01-01',
            to: '2026-01-01',
        });
    });
});

describe('isCustomRangeValid', () => {
    it('from < to → true', () => {
        expect(isCustomRangeValid('2026-01-01', '2026-01-02')).toBe(true);
    });

    it('from > to → false', () => {
        expect(isCustomRangeValid('2026-01-03', '2026-01-02')).toBe(false);
    });

    it('равные даты → true: однодневный диапазон разрешён', () => {
        expect(isCustomRangeValid('2026-01-01', '2026-01-01')).toBe(true);
    });
});
