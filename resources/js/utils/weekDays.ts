/**
 * Неделя пн–вс, содержащая «сегодня», по данным summary.days. Только
 * строковая/UTC-арифметика над Y-m-d: пояса и локаль браузера не участвуют.
 */

export interface WeekDay {
    ymd: string;
    dayNumber: number;
    weekday: string;
    /** null — день ещё не наступил. */
    count: number | null;
    isToday: boolean;
}

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function parse(ymd: string): number {
    const [year, month, day] = ymd.split('-').map(Number);

    return Date.UTC(year, month - 1, day);
}

function format(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Семь дней недели (пн–вс), в которую попадает todayYmd (Y-m-d в поясе профиля).
 * Счётчики берутся из days по дате; дни без записей получают 0, а будущие дни
 * (после todayYmd) — count = null.
 */
export function weekFromSummary(
    todayYmd: string,
    days: { date: string; count: number }[],
): WeekDay[] {
    const dayMs = 86_400_000;
    const todayMs = parse(todayYmd);
    // getUTCDay: 0 = вс; сдвиг к понедельнику.
    const offset = (new Date(todayMs).getUTCDay() + 6) % 7;
    const mondayMs = todayMs - offset * dayMs;
    const counts = new Map(days.map((day) => [day.date, day.count]));

    return WEEKDAYS.map((weekday, index) => {
        const ms = mondayMs + index * dayMs;
        const ymd = format(ms);

        return {
            ymd,
            dayNumber: Number(ymd.slice(8, 10)),
            weekday,
            count: ms > todayMs ? null : (counts.get(ymd) ?? 0),
            isToday: ms === todayMs,
        };
    });
}
