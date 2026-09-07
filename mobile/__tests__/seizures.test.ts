import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api/client';
import {
    createSeizure,
    deleteSeizure,
    listSeizures,
    updateSeizure,
} from '@/api/seizures';

vi.mock('@/api/client', () => ({
    apiFetch: vi.fn().mockResolvedValue({ data: [] }),
}));

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
    apiFetchMock.mockClear();
});

describe('listSeizures', () => {
    it('без from/to шлёт только per_page и timezone', async () => {
        await listSeizures({ timezone: 'Europe/Moscow' });

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures?per_page=50&timezone=Europe%2FMoscow',
        );
    });

    it('дописывает закодированные from/to после timezone', async () => {
        await listSeizures({
            timezone: 'Europe/Moscow',
            from: '2026-07-01',
            to: '2026-07-10',
        });

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/seizures?per_page=50&timezone=Europe%2FMoscow&from=2026-07-01&to=2026-07-10',
        );
    });

    it('учитывает каждую границу отдельно', async () => {
        await listSeizures({ timezone: 'UTC', from: '2026-07-01' });
        await listSeizures({ timezone: 'UTC', to: '2026-07-10' });

        expect(apiFetchMock).toHaveBeenNthCalledWith(
            1,
            '/seizures?per_page=50&timezone=UTC&from=2026-07-01',
        );
        expect(apiFetchMock).toHaveBeenNthCalledWith(
            2,
            '/seizures?per_page=50&timezone=UTC&to=2026-07-10',
        );
    });
});

describe('createSeizure', () => {
    it('передаёт тело как есть методом POST', async () => {
        const input = {
            timezone: 'Europe/Moscow',
            comment: 'утро',
            occurred_at: '2026-05-10T09:05:00',
        };

        await createSeizure(input);

        expect(apiFetchMock).toHaveBeenCalledWith('/seizures', {
            method: 'POST',
            body: input,
        });
    });
});

describe('deleteSeizure', () => {
    it('DELETE по id записи', async () => {
        await deleteSeizure(42);

        expect(apiFetchMock).toHaveBeenCalledWith('/seizures/42', {
            method: 'DELETE',
        });
    });
});

describe('updateSeizure', () => {
    it('PATCH по id с телом как есть, возвращает распакованный .data', async () => {
        const input = {
            timezone: 'Europe/Moscow',
            comment: 'x',
            occurred_at: '2026-09-07T10:00:00',
        };
        const seizure = {
            id: 42,
            occurred_at: '2026-09-07T07:00:00.000000Z',
            comment: 'x',
            created_at: '2026-09-07T09:00:00.000000Z',
        };
        apiFetchMock.mockResolvedValueOnce({ data: seizure });

        const result = await updateSeizure(42, input);

        expect(apiFetchMock).toHaveBeenCalledWith('/seizures/42', {
            method: 'PATCH',
            body: input,
        });
        expect(result).toEqual(seizure);
    });
});
