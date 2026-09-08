import * as SecureStore from 'expo-secure-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { __resetForTests, apiDownload, apiFetch } from '@/api/client';
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
const setItemAsync = SecureStore.setItemAsync as unknown as Mock<
    (key: string, value: string) => Promise<void>
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

    it('404 → not_found с текстом «не найдено»', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(404, {
                message:
                    'No query results for model [App\\Models\\Seizure] 123',
            }),
        );

        const error = await expectApiError(
            apiFetch('/seizures/123', { method: 'DELETE', auth: false }),
            'not_found',
        );

        expect(error.status).toBe(404);
        expect(userMessage(error)).toBe('Запись не найдена.');
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

describe('apiDownload', () => {
    const EXPORT_URL = `${API_BASE_URL}/seizures/export.docx`;
    const REFRESH_URL = `${API_BASE_URL}/token/refresh`;

    /** DOCX-подобное тело: 2 байта сигнатуры PK zip-архива. */
    function docxResponse(): Response {
        return new Response(new Uint8Array([0x50, 0x4b]), { status: 200 });
    }

    it('успех: Response с нетронутым бинарным телом, запрос с Bearer', async () => {
        getItemAsync.mockResolvedValue(JSON.stringify(storedAuth()));
        fetchMock.mockResolvedValue(docxResponse());

        const result = await apiDownload('/seizures/export.docx');

        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(200);
        expect(new Uint8Array(await result.arrayBuffer())).toEqual(
            new Uint8Array([0x50, 0x4b]),
        );

        const [url, init] = fetchMock.mock.calls[0];

        expect(url).toBe(EXPORT_URL);
        expect(init.headers.Authorization).toBe('Bearer access-1');
    });

    it('401 → refresh → повтор: возвращён второй Response, refresh один', async () => {
        let value = JSON.stringify(storedAuth());

        getItemAsync.mockImplementation(async () => value);
        setItemAsync.mockImplementation(async (_key: string, raw: string) => {
            value = raw;
        });

        let exportCalls = 0;

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                return jsonResponse(200, {
                    data: {
                        access_token: 'access-2',
                        refresh_token: 'refresh-2',
                        token_type: 'Bearer',
                        expires_in: 2592000,
                    },
                });
            }

            exportCalls += 1;

            return exportCalls === 1
                ? jsonResponse(401, { message: 'Unauthenticated.' })
                : docxResponse();
        });

        const result = await apiDownload('/seizures/export.docx');

        expect(result.status).toBe(200);
        expect(new Uint8Array(await result.arrayBuffer())).toEqual(
            new Uint8Array([0x50, 0x4b]),
        );

        expect(
            fetchMock.mock.calls.filter(([url]) => url === REFRESH_URL).length,
        ).toBe(1);

        // Повтор ушёл уже с обновлённым access-токеном.
        const authorizations = fetchMock.mock.calls
            .filter(([url]) => url === EXPORT_URL)
            .map(([, init]) => init.headers.Authorization);

        expect(authorizations).toEqual(['Bearer access-1', 'Bearer access-2']);
    });

    it('422 с errors → validation: toApiError применим к бинарному шву', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(422, {
                message: 'The from field must be a valid date.',
                errors: { from: ['The from field must be a valid date.'] },
            }),
        );

        const error = await expectApiError(
            apiDownload('/seizures/export.docx?from=oops'),
            'validation',
        );

        expect(error.fieldErrors).toEqual({
            from: ['The from field must be a valid date.'],
        });
    });

    it('TypeError от fetch → network', async () => {
        fetchMock.mockRejectedValue(new TypeError('boom'));

        await expectApiError(apiDownload('/seizures/export.docx'), 'network');
    });

    it('auth: false — без Authorization и без refresh на 401', async () => {
        getItemAsync.mockResolvedValue(JSON.stringify(storedAuth()));
        fetchMock.mockResolvedValue(
            jsonResponse(401, { message: 'Unauthenticated.' }),
        );

        await expectApiError(
            apiDownload('/seizures/export.docx', { auth: false }),
            'unauthorized',
        );

        const [, init] = fetchMock.mock.calls[0];

        expect(init.headers).not.toHaveProperty('Authorization');
        // 401 не триггерит refresh-очередь — ровно один запрос.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
