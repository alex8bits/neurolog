/**
 * Дискриминант ошибки API: определяет, как экран покажет её пользователю.
 * Платформо-независимый модуль — без импортов React/RN.
 */
export type ApiErrorKind =
    // 422 с errors.<field> — подсветка конкретных полей формы
    | 'validation'
    // 422 без errors — сообщение формы целиком (неверные учётные данные)
    | 'form'
    // 429 — троттлер API, есть Retry-After
    | 'rate_limit'
    // fetch бросил TypeError — нет связи/DNS
    | 'network'
    // 5xx и прочие неклассифицированные статусы
    | 'server'
    // 401 после исчерпания refresh — сессия истекла
    | 'unauthorized'
    // 404 — запрошенная запись не найдена (чужая/несуществующая/удалённая)
    | 'not_found';

export interface ApiErrorInit {
    /** HTTP-статус, если ответ вообще был. */
    status?: number;

    /** Ошибки полей; имеет смысл только при kind === 'validation'. */
    fieldErrors?: Record<string, string[]>;

    /** Секунды из заголовка Retry-After; только при kind === 'rate_limit'. */
    retryAfter?: number;

    /** Техническое сообщение (message из тела ответа) — не для UI. */
    message?: string;
}

export class ApiError extends Error {
    readonly kind: ApiErrorKind;

    readonly status?: number;

    readonly fieldErrors?: Record<string, string[]>;

    readonly retryAfter?: number;

    constructor(kind: ApiErrorKind, init: ApiErrorInit = {}) {
        super(init.message ?? kind);

        this.name = 'ApiError';
        this.kind = kind;
        this.status = init.status;
        this.fieldErrors = init.fieldErrors;
        this.retryAfter = init.retryAfter;
    }
}

/** Русские тексты для UI (PLAN.md, этап 1, шаг 7). */
export function userMessage(error: ApiError): string {
    switch (error.kind) {
        case 'network':
            return 'Нет связи. Проверьте подключение и повторите.';
        case 'rate_limit':
            return `Слишком много попыток, подождите ${error.retryAfter ?? 60} сек.`;
        case 'server':
            return 'Сервер недоступен, попробуйте позже.';
        case 'form':
            return 'Неверный email или пароль.';
        case 'unauthorized':
            return 'Сессия истекла, войдите снова.';
        case 'validation':
            return 'Проверьте введённые данные.';
        case 'not_found':
            return 'Запись не найдена.';
    }
}

/** Общий текст для неожиданных (не ApiError) сбоев. */
export const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** Текст ошибки действия (удаление, догрузка, экспорт): ApiError — по
 *  kind, неожиданное — общий. */
export function actionErrorText(error: unknown): string {
    return error instanceof ApiError ? userMessage(error) : GENERIC_ERROR_TEXT;
}
