/**
 * Оркестратор проверки обновления: запрос меты при старте и при каждом
 * возврате приложения в foreground (триггер — хук useUpdateCheck), но не
 * чаще одного успешного запроса за UPDATE_CHECK_INTERVAL_MS; одновременные
 * вызовы делят один запрос (single-flight). Решение — чистым ядром
 * shouldPromptForUpdate, показ — системный Alert с открытием APK в браузере,
 * не чаще одного раза за процесс на одну версию меты.
 *
 * Мета релиза — статика без авторизации, поэтому обычный fetch, а не
 * apiFetch (нет Bearer/refresh-логики). Запрос — в обход HTTP-кэша: nginx
 * отдаёт мету без Cache-Control, и OkHttp на Android считал её эвристически
 * свежей до суток, не выходя в сеть; поэтому уникальный query-параметр,
 * cache: 'no-store' и заголовки no-cache. Свою версию читаем из нативного
 * манифеста (nativeApplicationVersion = versionName из app.json; в Expo Go
 * это версия самого Expo Go — промпт там честно не сработает). Все сбои —
 * тихий fail-open: проверка не должна мешать входу.
 */
import { nativeApplicationVersion } from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Alert, Linking } from 'react-native';

import { APK_DOWNLOAD_URL, RELEASE_META_URL } from '@/config/env';
import { isNewerVersion, shouldPromptForUpdate } from '@/updates/version';

// Паттерн единого ключа (как AUTH_KEY в auth/tokens.ts), но значение —
// plain-строка: номер версии меты, на которую пользователь ответил отказом.
const DISMISSED_VERSION_KEY = 'update.dismissedVersion';

/** Минимальный интервал между успешными запросами меты (30 мин). */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

// Момент последнего успешного ответа меты (Date.now()); null — ещё не было.
// Сетевой сбой и не-2xx его не трогают: следующий триггер повторит запрос.
let lastSuccessAt: number | null = null;

// Идущий запрос: повторные вызовы во время него получают тот же промис.
let inFlight: Promise<string | null> | null = null;

// Версия меты, для которой диалог уже показан в этом процессе: возвраты
// из фона с той же метой не надоедают повторным диалогом.
let promptedVersion: string | null = null;

// Версия, диалог для которой заблокировал гейт canPrompt (например, сверху
// открыт /quick): покажем при следующем вызове, когда гейт разрешит, —
// в том числе в троттлинговой ветке, без сети.
let pendingPromptVersion: string | null = null;

// Мета новее установленной, найденная в этом процессе. Её показывает пункт
// «Скачать обновление» вкладки «Профиль» — независимо от отказа:
// «Позже» глушит только диалог, не знание о доступном обновлении
// (решение показать пункт — тоже чистое поле isNewerVersion).
let availableVersion: string | null = null;

const listeners = new Set<() => void>();

function setAvailableVersion(version: string | null): void {
    if (version === availableVersion) {
        return;
    }

    availableVersion = version;
    listeners.forEach((listener) => listener());
}

/** Текущая известная версия обновления (null — нет/не проверено). */
export function getAvailableUpdate(): string | null {
    return availableVersion;
}

/** Подписка на изменение доступной версии (для useSyncExternalStore). */
export function subscribeAvailableUpdate(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

/** Только для тестов: сброс состояния модуля. */
export function __resetForTests(): void {
    lastSuccessAt = null;
    inFlight = null;
    promptedVersion = null;
    pendingPromptVersion = null;
    availableVersion = null;
    listeners.clear();
}

/** Адрес меты с уникальным параметром — мимо любого HTTP-кэша. */
function metaRequestUrl(): string {
    const separator = RELEASE_META_URL.includes('?') ? '&' : '?';

    return `${RELEASE_META_URL}${separator}t=${Date.now()}`;
}

/** Сохранённый отказ; битая запись = «нет отказа» (как readTokens). */
async function readDismissed(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(DISMISSED_VERSION_KEY);
    } catch {
        return null;
    }
}

/** Записать отказ для версии меты. Перезапись идемпотентна (кнопка
 *  «Позже» и onDismiss могут сработать в паре); ошибка записи не критична —
 *  предложение просто повторится на следующем старте. */
async function persistDismissed(version: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(DISMISSED_VERSION_KEY, version);
    } catch {
        // Не сохранился отказ — тихо предложим снова на следующем старте.
    }
}

/** Объект-запись для безопасного доступа к телу меты. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Проверить обновление и, если мета новее, отказа на неё нет и диалог для
 * этой версии в процессе ещё не показывался, показать системный диалог.
 * В пределах UPDATE_CHECK_INTERVAL_MS после успешного запроса сеть не
 * трогает и сразу возвращает известное; во время идущего запроса
 * возвращает его промис. Возвращает версию доступного обновления (мета
 * новее установленной; null — нет/неизвестна): по ней вкладка «Профиль»
 * рисует пункт «Скачать обновление». Отказ «Позже» на возвращаемое
 * значение не влияет. Все сбои — тихий fail-open.
 *
 * canPrompt — гейт показа, читается непосредственно перед Alert (экран
 * мог смениться, пока шёл запрос). Запрет не считается показом: версия
 * откладывается и предлагается при следующем вызове.
 */
export function maybePromptUpdate(
    canPrompt: () => boolean = () => true,
): Promise<string | null> {
    if (inFlight !== null) {
        return inFlight;
    }

    // elapsed < 0 — часы откатили назад: считаем интервал истёкшим.
    const elapsed = lastSuccessAt === null ? -1 : Date.now() - lastSuccessAt;

    if (elapsed >= 0 && elapsed < UPDATE_CHECK_INTERVAL_MS) {
        if (pendingPromptVersion === null) {
            return Promise.resolve(availableVersion);
        }

        return tryPrompt(pendingPromptVersion, canPrompt).then(
            () => availableVersion,
        );
    }

    inFlight = runCheck(canPrompt).finally(() => {
        inFlight = null;
    });

    return inFlight;
}

async function runCheck(canPrompt: () => boolean): Promise<string | null> {
    // 1. Мета: статика релизного JSON, из тела нужна только version;
    //    любые ошибки сети/статуса/разбора — тихий возврат.
    let metaVersion: string | null = null;

    try {
        const response = await fetch(metaRequestUrl(), {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
            },
        });

        if (!response.ok) {
            return availableVersion;
        }

        const meta: unknown = await response.json();

        // Сервер ответил — троттлим, даже если тело без версии.
        lastSuccessAt = Date.now();

        if (isRecord(meta) && typeof meta.version === 'string') {
            metaVersion = meta.version;
        }
    } catch {
        return availableVersion;
    }

    // Битая мета — тупиковый путь: проверяем до readDismissed(), чтобы
    // не делать лишний I/O в SecureStore.
    if (metaVersion === null) {
        return availableVersion;
    }

    // Доступность для пункта меню — до учёта отказа (см. комментарий выше).
    const installedVersion = nativeApplicationVersion ?? null;

    setAvailableVersion(
        installedVersion !== null &&
            isNewerVersion(metaVersion, installedVersion)
            ? metaVersion
            : null,
    );

    await tryPrompt(metaVersion, canPrompt);

    return availableVersion;
}

/**
 * Показать диалог для версии меты, если он в процессе ещё не показывался,
 * отказа на неё нет и гейт canPrompt разрешает показ прямо сейчас. Запрет
 * гейта откладывает версию в pendingPromptVersion.
 */
async function tryPrompt(
    metaVersion: string,
    canPrompt: () => boolean,
): Promise<void> {
    // Диалог для этой версии уже был в процессе — не повторяем.
    if (promptedVersion === metaVersion) {
        return;
    }

    // Решение чистым ядром: своя версия — из нативного манифеста
    // (константа модуля, побочных эффектов у чтения нет).
    const dismissedVersion = await readDismissed();

    if (
        !shouldPromptForUpdate({
            metaVersion,
            installedVersion: nativeApplicationVersion ?? null,
            dismissedVersion,
        })
    ) {
        pendingPromptVersion = null;

        return;
    }

    // Повторно после await: параллельный вызов мог уже показать диалог.
    if (promptedVersion === metaVersion) {
        return;
    }

    if (!canPrompt()) {
        pendingPromptVersion = metaVersion;

        return;
    }

    promptedVersion = metaVersion;
    pendingPromptVersion = null;
    promptDownload(metaVersion);
}

/** Промпт обновления: «Скачать» открывает APK в браузере и ничего не
 *  сохраняет (пока версия меты не обновилась, следующий процесс предложит
 *  снова); «Позже» и закрытие мимо кнопки (onDismiss — тап вне/back на
 *  Android, cancel на iOS) сохраняют отказ для этой версии меты. */
function promptDownload(metaVersion: string): void {
    Alert.alert(
        'Обновление',
        `Доступна версия ${metaVersion}. Скачать с сайта?`,
        [
            {
                text: 'Позже',
                style: 'cancel',
                onPress: () => void persistDismissed(metaVersion),
            },
            {
                text: 'Скачать',
                onPress: () => {
                    // Паттерн доната из настроек: внешняя ссылка, при
                    // неудаче — короткий Alert без заголовка.
                    void Linking.openURL(APK_DOWNLOAD_URL).catch(() => {
                        Alert.alert(
                            '',
                            'Не удалось открыть страницу загрузки.',
                        );
                    });
                },
            },
        ],
        { onDismiss: () => void persistDismissed(metaVersion) },
    );
}
