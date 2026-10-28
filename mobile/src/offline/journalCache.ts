/**
 * Снимок журнала за последние 30 дней: окно «сегодня − 29 … сегодня» по
 * локальным дням устройства (как SeizureSummaryBuilder.php — 30 дней,
 * заканчивающихся сегодня). Чистые функции, без expo — покрываются юнит-тестами.
 */

import type { Seizure } from '@/api/types';

import { formatYmd, parseUtcIso } from '@/utils/time';

/** Длина окна кэша в днях, включая сегодняшний. */
export const WINDOW_DAYS = 30;

/** Локальный день `Y-m-d` момента occurred_at; непарсируемый → null. */
export function localDayOf(occurredAt: string): string | null {
    const moment = parseUtcIso(occurredAt);

    return moment === null ? null : formatYmd(moment);
}

/** Первый день окна: today − 29 календарных дней устройства. */
export function windowStartYmd(today: Date): string {
    return formatYmd(
        new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - (WINDOW_DAYS - 1),
        ),
    );
}

const momentMs = (occurredAt: string) =>
    parseUtcIso(occurredAt)?.getTime() ?? Number.NEGATIVE_INFINITY;

/** Порядок журнала: occurred_at DESC, при равенстве id DESC (SeizureQuery.php). */
export function compareJournalOrder(a: Seizure, b: Seizure): number {
    const diff = momentMs(b.occurred_at) - momentMs(a.occurred_at);

    return diff !== 0 ? diff : b.id - a.id;
}

/** Записи, чей локальный день ≥ начала окна; непарсируемые отбрасываются. */
export function pruneToWindow<T extends Seizure>(
    seizures: T[],
    today: Date,
): T[] {
    const start = windowStartYmd(today);

    return seizures.filter((seizure) => {
        const day = localDayOf(seizure.occurred_at);

        return day !== null && day >= start;
    });
}

const normalize = (seizures: Seizure[], today: Date) =>
    pruneToWindow(seizures, today).sort(compareJournalOrder);

/**
 * Свежий ответ сервера за окно целиком заменяет кэш за окно: записи,
 * удалённые на сервере, исчезают. Сохраняются только кэшированные записи
 * позже сегодняшнего дня — запрос окна (to = сегодня) их не возвращает.
 */
export function replaceWindow(
    cached: Seizure[],
    fresh: Seizure[],
    today: Date,
): Seizure[] {
    const todayYmd = formatYmd(today);
    const freshIds = new Set(fresh.map((seizure) => seizure.id));
    const beyondToday = cached.filter((seizure) => {
        const day = localDayOf(seizure.occurred_at);

        return day !== null && day > todayYmd && !freshIds.has(seizure.id);
    });

    return normalize([...fresh, ...beyondToday], today);
}

/** Добавляет или заменяет запись по id; результат обрезан и отсортирован. */
export function upsertSeizure(
    cached: Seizure[],
    seizure: Seizure,
    today: Date,
): Seizure[] {
    return normalize(
        [...cached.filter((item) => item.id !== seizure.id), seizure],
        today,
    );
}

/** Убирает запись по id. */
export function removeSeizure(cached: Seizure[], id: number): Seizure[] {
    return cached.filter((seizure) => seizure.id !== id);
}
