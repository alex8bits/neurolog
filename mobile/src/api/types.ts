/** Тело успешного ответа register / login / token/refresh. */
export interface TokenPair {
    access_token: string;
    refresh_token: string;
    token_type: string; // всегда "Bearer"
    expires_in: number; // секунды жизни access (30 суток = 2592000 при текущих env)
}

export interface TokenResponse {
    data: TokenPair; // стандартная обёртка Laravel-ресурсов
}

export interface RegisterInput {
    name: string;
    email: string;
    password: string; // password_confirmation клиент подставляет равным password
}

export interface LoginInput {
    email: string;
    password: string;
}

/** 422: errors есть при ошибке валидации полей и ОТСУТСТВУЕТ при неверных учётных данных. */
export interface ValidationErrorBody {
    message: string;
    errors?: Record<string, string[]>;
}

/** Элемент списка / ответа создания (SeizureResource, API V1). */
export interface Seizure {
    id: number;
    /** UTC ISO-8601 с микросекундами и Z — формат фиксирует SeizureResource.php:29. */
    occurred_at: string;
    comment: string | null;
    created_at: string | null;
}

/** Тело GET /seizures — пагинатор Laravel; этап 2 потребляет только data. */
export interface SeizureListResponse {
    data: Seizure[];
}

/** Тело ответа POST /seizures (201) — стандартная обёртка data. */
export interface SeizureResponse {
    data: Seizure;
}

/** Тело POST /seizures; occurred_at не шлём — «сейчас» ставит сервер. */
export interface CreateSeizureInput {
    timezone: string; // IANA
    comment?: string;
}
