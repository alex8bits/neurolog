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
    /** UUID, переданный клиентом при создании (идемпотентность POST);
     *  null у записей, созданных без него (веб, старые версии приложения). */
    client_id: string | null;
}

/** Мета пагинатора Laravel (GET /seizures, GET /medications): страницы
 *  считаются с 1; размер страницы — per_page запроса. */
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
 * `YYYY-MM-DDTHH:mm:ss` в поясе timezone либо UTC-момент с `Z`
 * (`2026-10-28T07:15:00.000Z`) — сервер доверяет смещению и нормализует
 * в UTC (SeizureMomentNormalizer.php). Отсутствие поля — момент на сервере
 * ставится «сейчас». client_id — UUID записи на устройстве: повтор POST с
 * тем же client_id возвращает уже созданную запись, а не дубль.
 */
export interface CreateSeizureInput {
    timezone: string; // IANA
    occurred_at?: string;
    comment?: string;
    client_id?: string;
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

/** День ленты сводки: Y-m-d в поясе запроса и число приступов. */
export interface SeizureSummaryDay {
    date: string; // Y-m-d
    count: number;
}

/** Итоги выбранного периода сводки. */
export interface SeizureSummaryPeriod {
    from: string | null;
    to: string | null;
    total: number;
    days_with_seizures: number;
}

/** Данные GET /seizures/summary: последние 30 дней (days, по возрастанию),
 *  сегодняшний день в поясе запроса и итоги периода. */
export interface SeizureSummary {
    timezone: string;
    today: string; // Y-m-d
    days: SeizureSummaryDay[];
    period: SeizureSummaryPeriod;
}

/** Тело ответа GET /seizures/summary — стандартная обёртка data. */
export interface SeizureSummaryResponse {
    data: SeizureSummary;
}

/** Параметры GET /seizures/summary; from/to — Y-m-d, как у списка. */
export interface SummaryParams {
    timezone: string; // IANA
    from?: string; // Y-m-d
    to?: string; // Y-m-d
}

/** Единица дозировки лекарства. */
export type MedicationUnit = 'mg' | 'ml';

/** Статус приёма относительно «сегодня» в поясе запроса (считает сервер). */
export type MedicationStatus = 'planned' | 'active' | 'finished';

/** Лекарство пользователя (MedicationResource, API V1). */
export interface Medication {
    id: number;
    medication_name_id: number;
    name: string;
    /** Строка с 5 знаками ("750.00000") — точное значение decimal с сервера. */
    dosage: string;
    unit: MedicationUnit;
    start_date: string; // Y-m-d
    end_date: string | null; // Y-m-d; null — приём без даты окончания
    status: MedicationStatus;
    created_at: string | null;
}

/** Позиция личного справочника лекарств (MedicationNameResource, API V1). */
export interface MedicationName {
    id: number;
    name: string;
    medications_count: number;
    created_at: string | null;
}

/** Тело GET /medication-names — весь справочник, без пагинации. */
export interface MedicationNameListResponse {
    data: MedicationName[];
}

/** Тело GET /medications — пагинатор Laravel; links клиенту не нужен. */
export interface MedicationListResponse {
    data: Medication[];
    meta: SeizureListMeta;
}

/** Тело ответа POST (201) / PATCH (200) /medications — обёртка data. */
export interface MedicationResponse {
    data: Medication;
}

/** Тело POST /medications и PATCH /medications/{id}; dosage — строка с
 *  точкой ("2.5"), см. normalizeDosageInput. */
export interface MedicationInput {
    /** Ровно одно из двух: id выбранной позиции справочника или новое
     *  название (сервер найдёт или создаст позицию без учёта регистра). */
    medication_name_id?: number;
    name?: string;
    dosage: string;
    unit: MedicationUnit;
    start_date: string; // Y-m-d
    end_date: string | null; // Y-m-d
}

/** Фильтры GET /medications; from/to — Y-m-d, пересечение с периодом приёма. */
export interface MedicationFilters {
    q?: string;
    from?: string; // Y-m-d
    to?: string; // Y-m-d
    status?: MedicationStatus;
}
