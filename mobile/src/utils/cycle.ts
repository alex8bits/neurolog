/**
 * Цикл приёма лекарства: «N дней приём, M дней перерыв», отсчёт от даты начала.
 * Платформо-независимый модуль. Текст совпадает с серверным MedicationCycle::label.
 */

const MAX_CYCLE_DAYS = 365;

/** 1/2 → "приём 1 дн. / перерыв 2 дн."; break 0 (ежедневно) → null. */
export function formatCycle(
    intakeDays: number,
    breakDays: number,
): string | null {
    if (breakDays <= 0) {
        return null;
    }

    return `приём ${intakeDays} дн. / перерыв ${breakDays} дн.`;
}

/** Поле ввода дней → целое 1–365 или null (пусто, не число, вне диапазона). */
export function parseCycleDays(raw: string): number | null {
    const value = raw.trim();

    if (!/^\d+$/.test(value)) {
        return null;
    }

    const days = Number(value);

    return days >= 1 && days <= MAX_CYCLE_DAYS ? days : null;
}
