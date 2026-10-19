import { describe, expect, it } from 'vitest';

import { weekFromSummary } from '@/utils/week';

describe('weekFromSummary', () => {
    it('неделя начинается с понедельника, будущие дни — null', () => {
        // 2026-07-08 — среда
        const week = weekFromSummary('2026-07-08', [
            { date: '2026-07-06', count: 2 },
            { date: '2026-07-08', count: 1 },
        ]);

        expect(week.map((d) => d.date)).toEqual([
            '2026-07-06',
            '2026-07-07',
            '2026-07-08',
            '2026-07-09',
            '2026-07-10',
            '2026-07-11',
            '2026-07-12',
        ]);
        expect(week.map((d) => d.count)).toEqual([
            2,
            0,
            1,
            null,
            null,
            null,
            null,
        ]);
        expect(week[2].isToday).toBe(true);
    });

    it('воскресенье как сегодня даёт полную неделю', () => {
        const week = weekFromSummary('2026-07-12', []);

        expect(week[0].date).toBe('2026-07-06');
        expect(week[6]).toEqual({
            date: '2026-07-12',
            count: 0,
            isToday: true,
        });
        expect(week.every((d) => d.count !== null)).toBe(true);
    });
});
