import { describe, expect, it } from 'vitest';

import type { Seizure } from '@/api/types';
import { runFlushPass } from '@/offline/flushCore';
import { markFailed, removeItem } from '@/offline/outbox';
import type { OutboxItem } from '@/offline/types';
import { ApiError } from '@/utils/errors';

const item = (seq: number): OutboxItem => ({
    client_id: `aaaaaaaa-0000-4000-8000-00000000000${seq}`,
    local_seq: seq,
    occurred_at: `2026-10-28T0${seq}:00:00.000Z`,
    timezone: 'Europe/Moscow',
    comment: null,
    created_at: `2026-10-28T0${seq}:00:00.000Z`,
    state: 'queued',
});

const accepted = (queued: OutboxItem): Seizure => ({
    id: queued.local_seq * 10,
    occurred_at: queued.occurred_at,
    comment: null,
    created_at: queued.occurred_at,
    client_id: queued.client_id,
});

/** In-memory очередь и кэш вместо journalStore; send — по сценарию. */
function harness(
    items: OutboxItem[],
    respond: (item: OutboxItem) => Seizure | ApiError,
) {
    let outbox = { version: 1 as const, owner: 'a@b.c', next_seq: 9, items };
    const cache: Seizure[] = [];
    const sent: string[] = [];

    const deps = {
        send: async (queued: OutboxItem) => {
            sent.push(queued.client_id);
            const result = respond(queued);

            if (result instanceof ApiError) {
                throw result;
            }

            return result;
        },
        getItems: () => outbox.items,
        addSynced: async (seizure: Seizure) => {
            cache.push(seizure);
        },
        remove: async (clientId: string) => {
            outbox = removeItem(outbox, clientId);
        },
        markFailed: async (clientId: string, error: string) => {
            outbox = markFailed(outbox, clientId, error);
        },
    };

    return { deps, cache, sent, items: () => outbox.items };
}

describe('runFlushPass', () => {
    it('2xx снимает элемент из очереди и кладёт запись в кэш', async () => {
        const h = harness([item(2), item(1)], accepted);

        expect(await runFlushPass(h.deps)).toBe('done');
        expect(h.sent).toEqual([item(1).client_id, item(2).client_id]);
        expect(h.items()).toEqual([]);
        expect(h.cache.map((s) => s.client_id)).toEqual(h.sent);
    });

    it('network останавливает проход, следующий элемент не отправляется', async () => {
        const h = harness([item(1), item(2)], () => new ApiError('network'));

        expect(await runFlushPass(h.deps)).toBe('stopped');
        expect(h.sent).toEqual([item(1).client_id]);
        expect(h.items().map((i) => i.state)).toEqual(['queued', 'queued']);
        expect(h.cache).toEqual([]);
    });

    it('422 помечает элемент failed, а проход идёт дальше', async () => {
        const h = harness([item(1), item(2)], (queued) =>
            queued.local_seq === 1
                ? new ApiError('validation', {
                      status: 422,
                      fieldErrors: { occurred_at: ['Время в будущем.'] },
                  })
                : accepted(queued),
        );

        expect(await runFlushPass(h.deps)).toBe('done');
        expect(h.items()).toEqual([
            { ...item(1), state: 'failed', error: 'Время в будущем.' },
        ]);
        expect(h.cache.map((s) => s.client_id)).toEqual([item(2).client_id]);
    });
});
