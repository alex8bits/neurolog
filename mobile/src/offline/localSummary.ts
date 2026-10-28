/**
 * Локальная сводка для недели и 30-дневной ленты журнала — зеркало
 * SeizureSummaryBuilder.php: 30 дней по возрастанию, последний — сегодня,
 * нулевые дни включены, подсчёт по локальным дням устройства.
 * Чистая функция, без expo.
 */

import type { Seizure, SeizureSummaryDay } from '@/api/types';
import { localDayOf, WINDOW_DAYS } from '@/offline/journalCache';

import { formatYmd } from '@/utils/time';

export function buildLocalSummary(
    entries: Seizure[],
    now: Date,
): { today: string; days: SeizureSummaryDay[] } {
    const counts = new Map<string, number>();

    for (const entry of entries) {
        const day = localDayOf(entry.occurred_at);

        if (day !== null) {
            counts.set(day, (counts.get(day) ?? 0) + 1);
        }
    }

    const days: SeizureSummaryDay[] = [];

    for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
        const date = formatYmd(
            new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset),
        );

        days.push({ date, count: counts.get(date) ?? 0 });
    }

    return { today: formatYmd(now), days };
}
