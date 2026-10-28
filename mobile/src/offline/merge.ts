/**
 * Склейка кэша серверных записей и очереди в строки журнала. Чистые функции,
 * без expo — покрываются юнит-тестами.
 */

import type { Seizure } from '@/api/types';
import { compareJournalOrder, localDayOf } from '@/offline/journalCache';
import type { JournalEntry, OutboxItem } from '@/offline/types';

/**
 * Серверные записи — 'synced'; записи очереди — с отрицательным id
 * (−local_seq) и sync = state. Запись очереди, чей client_id уже пришёл с
 * сервера, скрывается: ответ на POST мог потеряться, а запись уже создана.
 * Итог — occurred_at DESC, при равенстве id DESC.
 */
export function mergeEntries(
    cache: Seizure[],
    outbox: OutboxItem[],
): JournalEntry[] {
    const syncedClientIds = new Set(
        cache.flatMap((seizure) =>
            seizure.client_id === null ? [] : [seizure.client_id],
        ),
    );

    const synced: JournalEntry[] = cache.map((seizure) => ({
        ...seizure,
        sync: 'synced',
    }));

    const pending: JournalEntry[] = outbox
        .filter((item) => !syncedClientIds.has(item.client_id))
        .map((item) => ({
            id: -item.local_seq,
            occurred_at: item.occurred_at,
            comment: item.comment,
            created_at: item.created_at,
            client_id: item.client_id,
            sync: item.state,
        }));

    return [...synced, ...pending].sort(compareJournalOrder);
}

/**
 * Записи, чей локальный день occurred_at внутри [from, to] включительно
 * (семантика periodToRange, utils/period.ts); range === null — все записи.
 */
export function filterByRange<T extends Seizure>(
    entries: T[],
    range: { from: string; to: string } | null,
): T[] {
    if (range === null) {
        return entries;
    }

    return entries.filter((entry) => {
        const day = localDayOf(entry.occurred_at);

        return day !== null && day >= range.from && day <= range.to;
    });
}
