import * as SecureStore from 'expo-secure-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
    __resetForTests,
    apiFetch,
    onSessionExpired,
    resetSession,
} from '@/api/client';
import type { StoredAuth } from '@/auth/tokens';
import { API_BASE_URL } from '@/config/env';
import { ApiError } from '@/utils/errors';
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
const deleteItemAsync = SecureStore.deleteItemAsync as unknown as Mock<
    (key: string) => Promise<void>
>;

const fetchMock = vi.fn();

const SEIZURES_URL = `${API_BASE_URL}/seizures`;
const REFRESH_URL = `${API_BASE_URL}/token/refresh`;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function storedAuth(): StoredAuth {
    return {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        email: 'user@example.com',
    };
}

function tokenPairBody(access: string, refresh: string): unknown {
    return {
        data: {
            access_token: access,
            refresh_token: refresh,
            token_type: 'Bearer',
            expires_in: 2592000,
        },
    };
}

function unauthenticated(): Response {
    return jsonResponse(401, { message: 'Unauthenticated.' });
}

/** Stateful-мок SecureStore: запись/чтение/удаление одного ключа. */
function givenStorage(initial: StoredAuth | null): void {
    let value = initial === null ? null : JSON.stringify(initial);

    getItemAsync.mockImplementation(async () => value);
    setItemAsync.mockImplementation(async (_key: string, raw: string) => {
        value = raw;
    });
    deleteItemAsync.mockImplementation(async () => {
        value = null;
    });
}

function callsTo(url: string): number {
    return fetchMock.mock.calls.filter(([called]) => called === url).length;
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
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('refresh-очередь', () => {
    it('single-flight: два параллельных 401 → один POST /token/refresh', async () => {
        givenStorage(storedAuth());

        let seizuresCalls = 0;

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                return jsonResponse(
                    200,
                    tokenPairBody('access-2', 'refresh-2'),
                );
            }

            seizuresCalls += 1;

            return seizuresCalls <= 2
                ? unauthenticated()
                : jsonResponse(200, { data: [] });
        });

        const [first, second] = await Promise.all([
            apiFetch('/seizures'),
            apiFetch('/seizures'),
        ]);

        expect(first).toEqual({ data: [] });
        expect(second).toEqual({ data: [] });
        expect(callsTo(REFRESH_URL)).toBe(1);
        expect(callsTo(SEIZURES_URL)).toBe(4);

        // Оба исходных запроса ушли со старым access, оба повтора — с новым.
        const authorizations = fetchMock.mock.calls
            .filter(([url]) => url === SEIZURES_URL)
            .map(([, init]) => init.headers.Authorization);

        expect(authorizations).toEqual([
            'Bearer access-1',
            'Bearer access-1',
            'Bearer access-2',
            'Bearer access-2',
        ]);

        // Новая пара сохранена, email перенесён из прежней записи.
        expect(setItemAsync).toHaveBeenCalledWith(
            'auth.tokens',
            JSON.stringify({
                access_token: 'access-2',
                refresh_token: 'refresh-2',
                email: 'user@example.com',
            }),
        );
    });

    it('refresh 401: clearTokens + одно оповещение, waiters — unauthorized', async () => {
        givenStorage(storedAuth());

        const onExpired = vi.fn();

        onSessionExpired(onExpired);

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                return jsonResponse(401, {
                    message: 'Invalid or expired refresh token.',
                });
            }

            return unauthenticated();
        });

        await Promise.all([
            expectApiError(apiFetch('/seizures'), 'unauthorized'),
            expectApiError(apiFetch('/seizures'), 'unauthorized'),
        ]);

        expect(callsTo(REFRESH_URL)).toBe(1);
        expect(deleteItemAsync).toHaveBeenCalledTimes(1);
        expect(deleteItemAsync).toHaveBeenCalledWith('auth.tokens');
        expect(onExpired).toHaveBeenCalledTimes(1);
    });

    it('сетевая ошибка refresh не убивает сессию', async () => {
        givenStorage(storedAuth());

        const onExpired = vi.fn();

        onSessionExpired(onExpired);

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                throw new TypeError('Network request failed');
            }

            return unauthenticated();
        });

        await expectApiError(apiFetch('/seizures'), 'network');

        expect(deleteItemAsync).not.toHaveBeenCalled();
        expect(onExpired).not.toHaveBeenCalled();
    });

    it('ретрай один раз: повторный 401 → unauthorized без второго refresh', async () => {
        givenStorage(storedAuth());

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                return jsonResponse(
                    200,
                    tokenPairBody('access-2', 'refresh-2'),
                );
            }

            return unauthenticated();
        });

        await expectApiError(apiFetch('/seizures'), 'unauthorized');

        expect(callsTo(REFRESH_URL)).toBe(1);
        expect(callsTo(SEIZURES_URL)).toBe(2);
    });

    it('resetSession во время refresh: без ретрая, unauthorized', async () => {
        givenStorage(storedAuth());

        let resolveRefresh: ((response: Response) => void) | undefined;

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                return await new Promise<Response>((resolve) => {
                    resolveRefresh = resolve;
                });
            }

            return unauthenticated();
        });

        const pending = apiFetch('/seizures');

        await vi.waitFor(() => {
            expect(resolveRefresh).toBeDefined();
        });

        resetSession();

        resolveRefresh?.(
            jsonResponse(200, tokenPairBody('access-2', 'refresh-2')),
        );

        await expectApiError(pending, 'unauthorized');

        expect(callsTo(SEIZURES_URL)).toBe(1);
        expect(setItemAsync).not.toHaveBeenCalled();
    });

    it('refresh 401 после смены поколения НЕ чистит токены и НЕ уведомляет подписчика', async () => {
        givenStorage(storedAuth());

        const onExpired = vi.fn();

        onSessionExpired(onExpired);

        let resolveRefresh: ((response: Response) => void) | undefined;

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                return await new Promise<Response>((resolve) => {
                    resolveRefresh = resolve;
                });
            }

            return unauthenticated();
        });

        const pending = apiFetch('/seizures');

        await vi.waitFor(() => {
            expect(resolveRefresh).toBeDefined();
        });

        // Logout + повторный вход: поколение сменилось, в хранилище
        // уже НОВАЯ пара (B), а зависший refresh всё ещё работает со старой.
        resetSession();
        givenStorage({
            access_token: 'access-B',
            refresh_token: 'refresh-B',
            email: 'user@example.com',
        });

        resolveRefresh?.(
            jsonResponse(401, {
                message: 'Invalid or expired refresh token.',
            }),
        );

        await expectApiError(pending, 'unauthorized');

        expect(deleteItemAsync).not.toHaveBeenCalled();
        expect(onExpired).not.toHaveBeenCalled();

        // Пара B не тронута зависшим refresh'ем прошлого поколения.
        await expect(getItemAsync('auth.tokens')).resolves.toBe(
            JSON.stringify({
                access_token: 'access-B',
                refresh_token: 'refresh-B',
                email: 'user@example.com',
            }),
        );
    });

    it('бросивший подписчик не вытесняет ApiError и не мешает остальным', async () => {
        givenStorage(storedAuth());

        const throwing = vi.fn(() => {
            throw new Error('подписчик упал');
        });
        const second = vi.fn();

        onSessionExpired(throwing);
        onSessionExpired(second);

        fetchMock.mockImplementation(async (url: string) => {
            if (url === REFRESH_URL) {
                return jsonResponse(401, {
                    message: 'Invalid or expired refresh token.',
                });
            }

            return unauthenticated();
        });

        await expectApiError(apiFetch('/seizures'), 'unauthorized');

        expect(throwing).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(deleteItemAsync).toHaveBeenCalledTimes(1);
    });
});
