import { describe, expect, it } from 'vitest';

import type { Seizure } from '@/api/types';
import { pruneToWindow, replaceWindow } from '@/offline/journalCache';

/** Серверный формат occurred_at из локального Date (UTC ISO, 6 знаков, Z). */
const serverIso = (local: Date) =>
    `${local.toISOString().slice(0, 19)}.000000Z`;

const seizure = (id: number, local: Date): Seizure => ({
    id,
    occurred_at: serverIso(local),
    comment: null,
    created_at: null,
    client_id: null,
});

const today = new Date(2026, 9, 28, 12, 0);

describe('pruneToWindow', () => {
    it('оставляет запись ровно на начале окна (сегодня − 29) и выкидывает день раньше', () => {
        const atStart = seizure(1, new Date(2026, 8, 29, 0, 5));
        const dayBefore = seizure(2, new Date(2026, 8, 28, 23, 55));

        expect(pruneToWindow([atStart, dayBefore], today)).toEqual([atStart]);
    });
});

describe('replaceWindow', () => {
    it('записи, пропавшие на сервере, исчезают; итог — occurred_at DESC', () => {
        const kept = seizure(1, new Date(2026, 9, 20, 10, 0));
        const deleted = seizure(2, new Date(2026, 9, 21, 10, 0));
        const added = seizure(3, new Date(2026, 9, 27, 10, 0));

        expect(replaceWindow([kept, deleted], [kept, added], today)).toEqual([
            added,
            kept,
        ]);
    });
});
