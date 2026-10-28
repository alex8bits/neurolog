import { describe, expect, it } from 'vitest';

import type { Seizure } from '@/api/types';
import { appendSeizurePage } from '@/utils/seizureList';

/** Запись-фикстура: значимы только id и порядок. */
function seizure(id: number, occurredAt: string): Seizure {
    return {
        id,
        occurred_at: occurredAt,
        comment: null,
        created_at: null,
        client_id: null,
    };
}

describe('appendSeizurePage', () => {
    it('дописывает страницу после существующих записей, порядок не трогает', () => {
        const existing = [seizure(2, '2026-09-28T06:27:36.000000Z')];
        const incoming = [seizure(1, '2026-09-09T20:07:46.000000Z')];

        const result = appendSeizurePage(existing, incoming);

        expect(result.map((s) => s.id)).toEqual([2, 1]);
    });

    it('выкидывает записи, чей id уже показан — край страницы уехал в обе выборки', () => {
        const existing = [
            seizure(3, '2026-09-28T10:00:00.000000Z'),
            seizure(2, '2026-09-28T06:27:36.000000Z'),
        ];
        const incoming = [
            seizure(2, '2026-09-28T06:27:36.000000Z'),
            seizure(1, '2026-09-09T20:07:46.000000Z'),
        ];

        const result = appendSeizurePage(existing, incoming);

        expect(result.map((s) => s.id)).toEqual([3, 2, 1]);
    });

    it('когда страница целиком из дублей, возвращает прежний массив (та же ссылка)', () => {
        const existing = [seizure(1, '2026-09-09T20:07:46.000000Z')];
        const incoming = [seizure(1, '2026-09-09T20:07:46.000000Z')];

        expect(appendSeizurePage(existing, incoming)).toBe(existing);
    });

    it('пустая страница ничего не меняет и не копирует список', () => {
        const existing = [seizure(1, '2026-09-09T20:07:46.000000Z')];

        expect(appendSeizurePage(existing, [])).toBe(existing);
    });
});
