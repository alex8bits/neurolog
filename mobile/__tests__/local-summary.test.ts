import { describe, expect, it } from 'vitest';

import type { Seizure } from '@/api/types';
import { buildLocalSummary } from '@/offline/localSummary';
import { formatYmd } from '@/utils/time';

const seizure = (id: number, local: Date): Seizure => ({
    id,
    occurred_at: `${local.toISOString().slice(0, 19)}.000000Z`,
    comment: null,
    created_at: null,
    client_id: null,
});

describe('buildLocalSummary', () => {
    it('30 дней по возрастанию до сегодня, запись в 23:30 — в своём локальном дне', () => {
        const now = new Date(2026, 9, 28, 12, 0);
        const summary = buildLocalSummary(
            [
                seizure(1, new Date(2026, 9, 27, 23, 30)),
                seizure(2, new Date(2026, 9, 28, 0, 30)),
                seizure(3, new Date(2026, 9, 28, 10, 0)),
            ],
            now,
        );

        expect(summary.today).toBe(formatYmd(now));
        expect(summary.days).toHaveLength(30);
        expect(summary.days[0]?.date).toBe('2026-09-29');
        expect(summary.days[29]).toEqual({ date: formatYmd(now), count: 2 });
        expect(summary.days[28]).toEqual({ date: '2026-10-27', count: 1 });
        expect(summary.days.slice(0, 28).every((day) => day.count === 0)).toBe(
            true,
        );
    });
});
