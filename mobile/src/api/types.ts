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
