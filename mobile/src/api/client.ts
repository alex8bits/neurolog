import type { TokenResponse, ValidationErrorBody } from '@/api/types';
import { clearTokens, readTokens, saveTokens } from '@/auth/tokens';
import { API_BASE_URL } from '@/config/env';
import { ApiError } from '@/utils/errors';

export interface ApiFetchInit {
    // PATCH добавлен для updateSeizure (редактирование записи); на сам
    // запрос/refresh-очередь расширение не влияет — fetch принимает любой
    // HTTP-метод, union нужен только типам.
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';

    /** Сериализуется в JSON и ставит Content-Type: application/json. */
    body?: unknown;

    /**
     * Прикреплять ли Authorization и участвовать ли в refresh-очереди.
     * По умолчанию true; false — для login/register и самого refresh.
     */
    auth?: boolean;
}

type SessionExpiredHandler = () => void;

const sessionExpiredHandlers = new Set<SessionExpiredHandler>();

/** «Поколение» сессии: инкремент инвалидирует ждущие refresh запросы. */
let generation = 0;

/** Single-flight: единственный идущий POST /token/refresh. */
let refreshPromise: Promise<void> | null = null;

/** Подписка на «сессия истекла»; возвращает функцию отписки. */
export function onSessionExpired(handler: SessionExpiredHandler): () => void {
    sessionExpiredHandlers.add(handler);

    return () => {
        sessionExpiredHandlers.delete(handler);
    };
}

/** Инвалидация очереди «поколением» токенов; вызывается при logout. */
export function resetSession(): void {
    generation += 1;
}

/** Только для тестов: полный сброс внутреннего состояния модуля. */
export function __resetForTests(): void {
    generation = 0;
    refreshPromise = null;
    sessionExpiredHandlers.clear();
}

export async function apiFetch<T>(
    path: string,
    init?: ApiFetchInit,
): Promise<T> {
    const useAuth = init?.auth !== false;
    const generationAtStart = generation;

    let response = await request(path, init, useAuth);

    if (response.status === 401 && useAuth) {
        // 401 на защищённом запросе: ждём единственный refresh
        // и повторяем исходный запрос ровно один раз.
        await runRefresh();

        if (generation !== generationAtStart) {
            // Пока шёл refresh, сессию сбросили (logout/session-expired).
            throw new ApiError('unauthorized', { status: 401 });
        }

        response = await request(path, init, useAuth);
    }

    if (response.ok) {
        return (await parseJson(response)) as T;
    }

    throw await toApiError(response);
}

function runRefresh(): Promise<void> {
    if (refreshPromise === null) {
        refreshPromise = performRefresh().finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

async function performRefresh(): Promise<void> {
    const generationAtStart = generation;
    const stored = await readTokens();

    if (stored === null) {
        if (generation !== generationAtStart) {
            // Пока шёл refresh, сессию сбросили в другом «поколении» —
            // без побочных эффектов: разбор сессии уже выполнен там.
            throw new ApiError('unauthorized', { status: 401 });
        }

        // Обновлять нечем — сессии нет.
        expireSession();

        throw new ApiError('unauthorized', { status: 401 });
    }

    let response: Response;

    try {
        response = await fetch(`${API_BASE_URL}/token/refresh`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: stored.refresh_token }),
        });
    } catch (error) {
        if (error instanceof TypeError) {
            // Сервер недоступен — сессию НЕ убиваем: нет связи ≠ истекла.
            throw new ApiError('network');
        }

        throw error;
    }

    if (response.status === 401) {
        if (generation !== generationAtStart) {
            // Пока шёл refresh, сессию сбросили (logout/re-login) —
            // в хранилище уже может лежать новая пара, чистить её
            // и эмитить ложный session-expired нельзя.
            throw new ApiError('unauthorized', { status: 401 });
        }

        // Невалидный/просроченный refresh — сессия закончилась.
        await clearTokens();
        expireSession();

        throw new ApiError('unauthorized', { status: 401 });
    }

    if (!response.ok) {
        // 429/5xx на refresh — транзиентная ошибка, токены не трогаем.
        throw await toApiError(response);
    }

    const body = (await parseJson(response)) as TokenResponse | null;
    const pair = body?.data;

    // Truthy-проверка: null/пустая строка из кривого тела — тоже «нет пары».
    if (!pair?.access_token || !pair?.refresh_token) {
        throw new ApiError('server', { status: response.status });
    }

    if (generation !== generationAtStart) {
        // Пока шёл refresh, сессию сбросили — не перезаписываем токены.
        throw new ApiError('unauthorized', { status: 401 });
    }

    await saveTokens(pair, stored.email);
}

function expireSession(): void {
    generation += 1;

    for (const handler of sessionExpiredHandlers) {
        try {
            handler();
        } catch {
            // Исключение подписчика не должно вытеснять ApiError из
            // rejection ждущих очереди и мешать остальным подписчикам.
        }
    }
}

async function request(
    path: string,
    init: ApiFetchInit | undefined,
    useAuth: boolean,
): Promise<Response> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };

    if (init?.body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (useAuth) {
        const stored = await readTokens();

        if (stored !== null) {
            headers.Authorization = `Bearer ${stored.access_token}`;
        }
    }

    try {
        return await fetch(`${API_BASE_URL}${path}`, {
            method: init?.method ?? 'GET',
            headers,
            body:
                init?.body === undefined
                    ? undefined
                    : JSON.stringify(init.body),
        });
    } catch (error) {
        if (error instanceof TypeError) {
            throw new ApiError('network');
        }

        throw error;
    }
}

async function toApiError(response: Response): Promise<ApiError> {
    const body = (await parseJson(response)) as ValidationErrorBody | null;

    if (response.status === 401) {
        return new ApiError('unauthorized', {
            status: 401,
            message: body?.message,
        });
    }

    if (response.status === 422) {
        const fieldErrors = body?.errors;

        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
            return new ApiError('validation', {
                status: 422,
                fieldErrors,
                message: body?.message,
            });
        }

        return new ApiError('form', {
            status: 422,
            message: body?.message,
        });
    }

    if (response.status === 429) {
        const retryAfter = Number.parseInt(
            response.headers.get('Retry-After') ?? '',
            10,
        );

        return new ApiError('rate_limit', {
            status: 429,
            retryAfter: Number.isNaN(retryAfter) ? undefined : retryAfter,
        });
    }

    if (response.status === 404) {
        return new ApiError('not_found', {
            status: 404,
            message: body?.message,
        });
    }

    // 5xx и прочие незаконтрактованные статусы.
    return new ApiError('server', {
        status: response.status,
        message: body?.message,
    });
}

async function parseJson(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        // 204/пустое тело/не-JSON — трактуем как «тела нет».
        return null;
    }
}
