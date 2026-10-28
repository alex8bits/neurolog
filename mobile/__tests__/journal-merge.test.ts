import { describe, expect, it } from 'vitest';

import type { Seizure } from '@/api/types';
import { mergeEntries } from '@/offline/merge';
import type { OutboxItem } from '@/offline/types';

const server: Seizure = {
    id: 10,
    occurred_at: '2026-10-28T07:00:00.000000Z',
    comment: null,
    created_at: '2026-10-28T07:00:01.000000Z',
    client_id: 'aaaaaaaa-0000-4000-8000-000000000001',
};

const outboxItem = (
    seq: number,
    clientId: string,
    occurredAt: string,
    state: OutboxItem['state'],
): OutboxItem => ({
    client_id: clientId,
    local_seq: seq,
    occurred_at: occurredAt,
    timezone: 'Europe/Moscow',
    comment: null,
    created_at: occurredAt,
    state,
});

describe('mergeEntries', () => {
    it('скрывает элемент очереди, чей client_id уже пришёл с сервера; остальные — с отрицательным id и своим sync', () => {
        const duplicate = outboxItem(
            1,
            server.client_id!,
            '2026-10-28T07:00:00.000Z',
            'queued',
        );
        const queued = outboxItem(
            2,
            'aaaaaaaa-0000-4000-8000-000000000002',
            '2026-10-28T09:00:00.000Z',
            'queued',
        );
        const failed = outboxItem(
            3,
            'aaaaaaaa-0000-4000-8000-000000000003',
            '2026-10-28T08:00:00.000Z',
            'failed',
        );

        const entries = mergeEntries([server], [duplicate, queued, failed]);

        expect(entries.map((entry) => [entry.id, entry.sync])).toEqual([
            [-2, 'queued'],
            [-3, 'failed'],
            [10, 'synced'],
        ]);
    });
});
