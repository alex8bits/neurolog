import * as SecureStore from 'expo-secure-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { __resetForTests, apiFetch } from '@/api/client';
import type { StoredAuth } from '@/auth/tokens';
import { API_BASE_URL } from '@/config/env';
import { ApiError, userMessage } from '@/utils/errors';
import type { ApiErrorKind } from '@/utils/errors';

vi.mock('expo-secure-store', () => ({
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
}));

const getItemAsync = SecureStore.getItemAsync as unknown as Mock<
    (key: string) => Promise<string | null>
>;

const fetchMock = vi.fn();

function jsonResponse(
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

function storedAuth(): StoredAuth {
    return {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        email: 'user@example.com',
    };
}

async function expectApiError(
    promise: Promise<unknown>,
    kind: ApiErrorKind,
): Promise<ApiError> {
    const error = await promise.then(
        () => {
            throw new Error('ожидался reject');
        },
        (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind });

    return error as ApiError;
}

beforeEach(() => {
    vi.resetAllMocks();
    __resetForTests();
    vi.stubGlobal('fetch', fetchMock);
    getItemAsync.mockResolvedValue(null);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('apiFetch: заголовки и URL', () => {
    it('шлёт Accept: application/json, URL = API_BASE_URL + path', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));

        await apiFetch('/seizures');

        const [url, init] = fetchMock.mock.calls[0];

        expect(url).toBe(`${API_BASE_URL}/seizures`);
        expect(init.method).toBe('GET');
        expect(init.headers).toEqual({ Accept: 'application/json' });
    });

    it('Content-Type и JSON-тело — только при body', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { data: null }));

        await apiFetch('/login', {
            method: 'POST',
            auth: false,
            body: { email: 'user@example.com', password: 'secret' },
        });

        const [, init] = fetchMock.mock.calls[0];

        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({
            Accept: 'application/json',
            'Content-Type': 'application/json',
        });
        expect(init.body).toBe(
            JSON.stringify({
                email: 'user@example.com',
                password: 'secret',
            }),
        );
    });

    it('Authorization прикрепляется при наличии токенов', async () => {
        getItemAsync.mockResolvedValue(JSON.stringify(storedAuth()));
        fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));

        await apiFetch('/seizures');

        const [, init] = fetchMock.mock.calls[0];

        expect(init.headers.Authorization).toBe('Bearer access-1');
    });

    it('auth: false — без Authorization даже при наличии токенов', async () => {
        getItemAsync.mockResolvedValue(JSON.stringify(storedAuth()));
        fetchMock.mockResolvedValue(jsonResponse(200, { data: null }));

        await apiFetch('/login', { method: 'POST', auth: false, body: {} });

        const [, init] = fetchMock.mock.calls[0];

        expect(init.headers).not.toHaveProperty('Authorization');
    });
});

describe('apiFetch: маппинг статусов в ApiError', () => {
    it('422 с errors.<field> → validation с fieldErrors', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(422, {
                message: 'The email field is required.',
                errors: { email: ['The email field is required.'] },
            }),
        );

        const error = await expectApiError(
            apiFetch('/login', { method: 'POST', auth: false, body: {} }),
            'validation',
        );

        expect(error.fieldErrors).toEqual({
            email: ['The email field is required.'],
        });
    });

    it('422 без errors → form (неверные учётные данные)', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(422, {
                message: 'These credentials do not match our records.',
            }),
        );

        const error = await expectApiError(
            apiFetch('/login', { method: 'POST', auth: false, body: {} }),
            'form',
        );

        expect(error.fieldErrors).toBeUndefined();
    });

    it('429 с Retry-After: 77 → rate_limit с retryAfter 77', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(
                429,
                { message: 'Too Many Attempts.' },
                { 'Retry-After': '77' },
            ),
        );

        const error = await expectApiError(
            apiFetch('/login', { method: 'POST', auth: false, body: {} }),
            'rate_limit',
        );

        expect(error.retryAfter).toBe(77);
        expect(userMessage(error)).toBe(
            'Слишком много попыток, подождите 77 сек.',
        );
    });

    it('500 → server', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(500, { message: 'Server Error' }),
        );

        await expectApiError(apiFetch('/seizures', { auth: false }), 'server');
    });

    it('TypeError от fetch → network', async () => {
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await expectApiError(apiFetch('/seizures', { auth: false }), 'network');
    });

    it('204 с пустым телом резолвится без ошибки', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

        const result = await apiFetch<void>('/logout', {
            method: 'POST',
            auth: false,
        });

        expect(result).toBeNull();
    });
});
