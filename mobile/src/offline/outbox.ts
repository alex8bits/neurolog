/**
 * Очередь неотправленных записей. Чистые функции над OutboxFile, без expo.
 * Очередь никогда не обрезается по возрасту — неотправленные данные не теряются.
 */

import type { OutboxFile, OutboxItem } from '@/offline/types';

/** Пустая очередь владельца. */
export function emptyOutbox(owner: string): OutboxFile {
    return { version: 1, owner, next_seq: 1, items: [] };
}

/**
 * Кладёт запись в конец очереди со следующим local_seq и state 'queued'.
 * Повтор с уже стоящим в очереди client_id ничего не меняет.
 */
export function enqueue(
    file: OutboxFile,
    input: Omit<OutboxItem, 'local_seq' | 'state' | 'created_at'>,
    now: Date,
): OutboxFile {
    if (file.items.some((item) => item.client_id === input.client_id)) {
        return file;
    }

    const item: OutboxItem = {
        ...input,
        local_seq: file.next_seq,
        state: 'queued',
        created_at: now.toISOString(),
    };

    return {
        ...file,
        next_seq: file.next_seq + 1,
        items: [...file.items, item],
    };
}

/** Убирает запись по client_id (принята сервером или удалена пользователем). */
export function removeItem(file: OutboxFile, clientId: string): OutboxFile {
    return {
        ...file,
        items: file.items.filter((item) => item.client_id !== clientId),
    };
}

/** Помечает запись как не сохранённую сервером (422) с текстом ошибки. */
export function markFailed(
    file: OutboxFile,
    clientId: string,
    error: string,
): OutboxFile {
    return {
        ...file,
        items: file.items.map((item) =>
            item.client_id === clientId
                ? { ...item, state: 'failed', error }
                : item,
        ),
    };
}
