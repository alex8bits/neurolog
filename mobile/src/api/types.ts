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

/** Мета пагинатора Laravel в ответе GET /seizures: страницы считаются с 1,
 *  записи — по 50 свежайших (occurred_at DESC, id DESC). */
export interface SeizureListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

/** Тело GET /seizures — пагинатор Laravel; links клиенту не нужен, страницы
 *  листает по meta (догрузка следующих — loadMore журнала). */
export interface SeizureListResponse {
    data: Seizure[];
    meta: SeizureListMeta;
}

/** Тело ответа POST /seizures (201) — стандартная обёртка data. */
export interface SeizureResponse {
    data: Seizure;
}

/**
 * Тело POST /seizures. occurred_at — опциональная наивная строка
 * `YYYY-MM-DDTHH:mm:ss` в поясе timezone; сервер нормализует её в UTC
 * (SeizureMomentNormalizer.php). Отсутствие поля — момент на сервере
 * ставится «сейчас».
 */
export interface CreateSeizureInput {
    timezone: string; // IANA
    occurred_at?: string;
    comment?: string;
}

/** Параметры GET /seizures; from/to — Y-m-d, границы включительно (сервер
 *  трактует их целыми календарными днями в разрешённом поясе). */
export interface ListSeizuresParams {
    timezone: string; // IANA
    from?: string; // Y-m-d
    to?: string; // Y-m-d
    /** Страница пагинатора, 1-based; не задана — первая. */
    page?: number;
}

/** Период экспорта/писем: те же параметры, что у списка (GET /seizures). */
export interface ExportPeriodParams {
    timezone: string; // IANA
    from?: string; // Y-m-d
    to?: string; // Y-m-d
}

/** Тело POST /seizures/email-doctor. */
export interface EmailDoctorInput {
    to: string;
    subject?: string;
    body?: string;
}

/** Тело 200 email-self / email-doctor. */
export interface EmailMessageResponse {
    message: string;
}

/** Профиль пользователя (UserResource, API V1). */
export interface UserProfile {
    id: number;
    name: string;
    email: string;
    timezone: string; // IANA
}

/** Группа поясов селектора (App\Support\Timezones::grouped()). */
export interface TimezoneGroup {
    region: string;
    zones: string[];
}

/** Тело GET /profile: профиль + список поясов для селектора. */
export interface ProfileResponse {
    data: UserProfile;
    timezones: TimezoneGroup[];
}

/** Тело PATCH /profile. */
export interface UpdateProfileInput {
    name: string;
    email: string;
    timezone: string;
}

/** Тело PATCH /profile/password (422: неверный текущий/слабый новый —
 *  errors по полям current_password/password). */
export interface UpdatePasswordInput {
    current_password: string;
    password: string;
    password_confirmation: string;
}

/** Тело POST /feedback (422: пустые имя/почта/короткий текст — errors
 *  по полям name/email/message). */
export interface FeedbackInput {
    anonymous: boolean;
    name: string;
    email: string;
    message: string;
}
