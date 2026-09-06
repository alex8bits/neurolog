/**
 * Парсер и форматтер моментов API. Сервер отдаёт occurred_at/created_at
 * как UTC ISO-8601 с микросекундами и Z (SeizureResource.php:29).
 * Платформо-независимый модуль — без импортов React/RN (как errors.ts).
 */

const UTC_ISO_RE =
    /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?Z$/;

/** Строгий парсер UTC-ISO; микросекунды усекаются до миллисекунд, мусор → null. */
export function parseUtcIso(value: string): Date | null {
    const match = UTC_ISO_RE.exec(value);

    if (match === null) {
        return null;
    }

    const [, year, month, day, hour, minute, second, fraction] = match;
    const ms = fraction ? Math.floor(Number(`0.${fraction}`) * 1000) : 0;

    return new Date(
        Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
            ms,
        ),
    );
}

/** «10.05.2026, 16:15» в поясе устройства; непарсируемое — как есть. */
export function formatLocalDateTime(value: string): string {
    const date = parseUtcIso(value);

    if (date === null) {
        return value;
    }

    const pad = (part: number) => String(part).padStart(2, '0');

    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
