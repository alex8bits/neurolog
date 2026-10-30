/**
 * Календарные даты `Y-m-d` (start_date / end_date лекарств, фильтры
 * периода) на экране и в пикерах. Платформо-независимый модуль — без
 * импортов React/RN.
 */

/** "2026-10-25" → локальная полночь этого дня (значение DateTimePicker). */
export function parseYmdLocal(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);

    return new Date(y, m - 1, d);
}

/** "2026-10-25" → "25.10.2026"; не-Y-m-d возвращается как есть. */
export function formatYmdDisplay(ymd: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);

    return match === null ? ymd : `${match[3]}.${match[2]}.${match[1]}`;
}
