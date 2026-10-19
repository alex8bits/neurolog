/**
 * Неделя пн–вс для блока журнала. Только строковая арифметика по Y-m-d
 * (календарь UTC без пояса) — «сегодня» приходит с сервера в поясе
 * пользователя, Date с локальным поясом не используем.
 */

import type { SeizureSummaryDay } from '@/api/types';

export interface WeekDay {
    date: string; // Y-m-d
    /** Число приступов; null — день ещё не наступил. */
    count: number | null;
    isToday: boolean;
}

const DAY_MS = 86_400_000;

function toUtcMs(ymd: string): number {
    const [y, m, d] = ymd.split('-').map(Number);

    return Date.UTC(y, m - 1, d);
}

function addDaysYmd(ymd: string, days: number): string {
    return new Date(toUtcMs(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Неделя (пн–вс), содержащая today. Дни до сегодня без записи в сводке — 0,
 *  будущие — null. */
export function weekFromSummary(
    today: string,
    days: SeizureSummaryDay[],
): WeekDay[] {
    // getUTCDay: 0 = вс; сдвиг до понедельника.
    const dow = new Date(toUtcMs(today)).getUTCDay();
    const monday = addDaysYmd(today, -((dow + 6) % 7));
    const counts = new Map(days.map((day) => [day.date, day.count]));

    return Array.from({ length: 7 }, (_, i) => {
        const date = addDaysYmd(monday, i);

        return {
            date,
            count: date > today ? null : (counts.get(date) ?? 0),
            isToday: date === today,
        };
    });
}
