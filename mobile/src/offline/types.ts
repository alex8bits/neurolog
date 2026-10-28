/**
 * Типы локальных данных автономного режима: снимок журнала за 30 дней
 * (journal-cache.json) и очередь неотправленных записей (outbox.json).
 * Платформо-независимый модуль — без импортов React/RN/expo.
 */

import type { Seizure } from '@/api/types';

/** Запись, сохранённая на устройстве и ещё не принятая сервером. */
export interface OutboxItem {
    /** UUID — уходит на сервер как client_id, повтор POST не создаёт дубль. */
    client_id: string;
    /** Монотонный номер на устройстве, для стабильного отрицательного id в UI. */
    local_seq: number;
    /** UTC ISO с Z — момент нажатия / выбранный пользователем. */
    occurred_at: string;
    /** IANA-пояс устройства на момент создания. */
    timezone: string;
    comment: string | null;
    /** UTC ISO, когда запись положили в очередь. */
    created_at: string;
    state: 'queued' | 'failed';
    /** Текст ошибки для state === 'failed'. */
    error?: string;
}

/** Снимок серверных записей за последние 30 дней. */
export interface JournalCacheFile {
    version: 1;
    /** Email владельца: данные другого пользователя не показываются. */
    owner: string;
    /** UTC ISO последней успешной загрузки окна; null — ещё не загружали. */
    synced_at: string | null;
    seizures: Seizure[];
}

/** Очередь неотправленных записей; по возрасту никогда не обрезается. */
export interface OutboxFile {
    version: 1;
    owner: string;
    next_seq: number;
    items: OutboxItem[];
}

/** Строка журнала: серверная запись или локальная из очереди. */
export type JournalEntry = Seizure & { sync: 'synced' | 'queued' | 'failed' };
