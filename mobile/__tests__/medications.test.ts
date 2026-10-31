import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api/client';
import { createMedication, listMedications } from '@/api/medications';

vi.mock('@/api/client', () => ({
    apiFetch: vi.fn().mockResolvedValue({
        data: [],
        meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    }),
}));

vi.mock('@/config/timezone', () => ({
    deviceTimezone: () => 'Europe/Moscow',
}));

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
    apiFetchMock.mockClear();
});

describe('listMedications', () => {
    it('q обрезается и кодируется, status после него, page последним', async () => {
        await listMedications({ q: ' виг ', status: 'active' }, 2);

        expect(apiFetchMock).toHaveBeenCalledWith(
            `/medications?per_page=20&timezone=Europe%2FMoscow&q=${encodeURIComponent('виг')}&status=active&page=2`,
        );
    });
});

describe('createMedication', () => {
    it('POST с телом как есть, возвращает распакованный .data', async () => {
        const input = {
            name: 'Вигабатрин',
            dosage: '750',
            unit: 'mg' as const,
            start_date: '2026-10-01',
            end_date: null,
        };
        const medication = {
            id: 7,
            ...input,
            dosage: '750.00000',
            medication_name_id: 3,
            status: 'active' as const,
            created_at: '2026-10-30T09:00:00.000000Z',
        };
        apiFetchMock.mockResolvedValueOnce({ data: medication });

        const result = await createMedication(input);

        expect(apiFetchMock).toHaveBeenCalledWith('/medications', {
            method: 'POST',
            body: input,
        });
        expect(result).toEqual(medication);
    });
});
