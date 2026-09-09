/**
 * Домен фильтра периода журнала: маппинг выбранного пресета в параметры
 * from/to запроса индекса. Пресеты «Сегодня / 7 дней / 30 дней» —
 * включительные календарные дни в поясе устройства, ровно та семантика,
 * по которой сервер строит UTC-границы (app/Services/SeizureQuery.php:54-81:
 * startOfDay/endOfDay в разрешённой tz).
 * Платформо-независимый модуль — без импортов React/RN (как time.ts).
 */

import { formatYmd } from '@/utils/time';

/** Выбранный фильтр периода в списке журнала; дефолт — { kind: 'last7' }. */
export type PeriodFilter =
    | { kind: 'all' }
    | { kind: 'today' }
    | { kind: 'last7' }
    | { kind: 'last30' }
    // строки Y-m-d; валидность диапазона проверяется до создания объекта
    | { kind: 'custom'; from: string; to: string };

/** Календарная арифметика: конструктор Date сам разруливает переполнение месяца/года. */
const addDays = (date: Date, days: number): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Параметры from/to (Y-m-d) для запроса индекса либо null, когда фильтр
 * не задан: «Всё время» — параметры не шлются вовсе, сервер отвечает без
 * ограничений периода. Пресеты заканчиваются сегодняшним днём. Объект
 * custom возвращается как есть: контракт — вызывающая сторона гарантирует
 * валидный диапазон (isCustomRangeValid) до создания объекта custom.
 * now — параметр для тестируемости.
 */
export function periodToRange(
    period: PeriodFilter,
    now: Date = new Date(),
): { from: string; to: string } | null {
    switch (period.kind) {
        case 'all':
            return null;
        case 'today':
            return { from: formatYmd(now), to: formatYmd(now) };
        case 'last7':
            return { from: formatYmd(addDays(now, -6)), to: formatYmd(now) };
        case 'last30':
            return { from: formatYmd(addDays(now, -29)), to: formatYmd(now) };
        case 'custom':
            return { from: period.from, to: period.to };
    }
}

/**
 * Валиден ли custom-диапазон: from ≤ to лексикографически. Формат Y-m-d
 * фиксированной длины — порядок строк совпадает с хронологическим; равные
 * значения разрешены, как серверный after_or_equal
 * (app/Http/Requests/Api/V1/IndexSeizureRequest.php:23-31).
 */
export function isCustomRangeValid(from: string, to: string): boolean {
    return from <= to;
}
