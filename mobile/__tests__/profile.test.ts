import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/api/client';
import { deleteAccount, fetchProfile, updateProfile } from '@/api/profile';

vi.mock('@/api/client', () => ({
    apiFetch: vi.fn().mockResolvedValue({ data: [] }),
}));

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
    apiFetchMock.mockClear();
});

describe('fetchProfile', () => {
    it('GET /profile без инициализатора; ответ с data и timezones — как есть', async () => {
        const response = {
            data: {
                id: 42,
                name: 'Alex',
                email: 'user@example.com',
                timezone: 'Europe/Moscow',
            },
            timezones: [
                { region: 'Europe', zones: ['Europe/Moscow', 'Europe/Kyiv'] },
            ],
        };
        apiFetchMock.mockResolvedValueOnce(response);

        const result = await fetchProfile();

        expect(apiFetchMock).toHaveBeenCalledWith('/profile');
        expect(result).toEqual(response);
    });
});

describe('updateProfile', () => {
    it('PATCH /profile с телом как есть; возвращает распакованный .data', async () => {
        const input = {
            name: 'Alex',
            email: 'new@example.com',
            timezone: 'Europe/Moscow',
        };
        const profile = {
            id: 42,
            name: 'Alex',
            email: 'new@example.com',
            timezone: 'Europe/Moscow',
        };
        apiFetchMock.mockResolvedValueOnce({ data: profile });

        const result = await updateProfile(input);

        expect(apiFetchMock).toHaveBeenCalledWith('/profile', {
            method: 'PATCH',
            body: input,
        });
        expect(result).toEqual(profile);
    });
});

describe('deleteAccount', () => {
    it('DELETE /profile с паролем в теле; разрешается без значения', async () => {
        await expect(deleteAccount('secret')).resolves.toBeUndefined();

        expect(apiFetchMock).toHaveBeenCalledWith('/profile', {
            method: 'DELETE',
            body: { password: 'secret' },
        });
    });
});
