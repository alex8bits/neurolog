/**
 * Парсер и форматтер моментов API. Сервер отдаёт occurred_at/created_at
 * как UTC ISO-8601 с микросекундами и Z (SeizureResource.php:29).
 * Платформо-независимый модуль — без импортов React/RN (как errors.ts).
 */

const UTC_ISO_RE =
    /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?Z$/;

/** Двузначный паддинг компонентов даты/времени: 5 → '05'. */
const pad = (part: number) => String(part).padStart(2, '0');

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

    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Локальная дата `YYYY-MM-DD` для параметров фильтра from/to: сервер ждёт
 * формат Y-m-d и трактует границы как целые календарные дни включительно
 * (IndexSeizureRequest.php, SeizureQuery.php).
 */
export function formatYmd(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Наивная локальная строка `YYYY-MM-DDTHH:mm:ss` для occurred_at при записи
 * задним числом: без Z и без смещения — сервер сам парсит её в поданной
 * timezone и нормализует в UTC (SeizureMomentNormalizer.php).
 */
export function toNaiveLocalIso(date: Date): string {
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    return `${formatYmd(date)}T${time}`;
}

/**
 * Строгое «дальше, чем now + minutes»: сервер запрещает occurred_at строго
 * больше now(UTC) + 5 минут (SeizureValidationRules.php) — ровно граница
 * разрешена. Порог задаёт вызывающий код; now — параметр для тестируемости.
 */
export function isBeyondNowPlusMinutes(
    date: Date,
    minutes: number,
    now: Date = new Date(),
): boolean {
    return date.getTime() > now.getTime() + minutes * 60_000;
}

/** «09:05» из локальных геттеров — подпись кнопки «Время» у пикера. */
export function formatHm(date: Date): string {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Момент, округлённый вниз до минуты (секунды/мс — в ноль): стартовое
 *  значение пикера «Точное время»; date — параметр для тестируемости. */
export function startOfMinute(date: Date = new Date()): Date {
    return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}
