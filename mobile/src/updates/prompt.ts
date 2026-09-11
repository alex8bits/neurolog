/**
 * Оркестратор проверки обновления: не чаще одного запроса меты за жизнь
 * процесса, решение — чистым ядром shouldPromptForUpdate, показ — системный
 * Alert с открытием APK в браузере. Мета релиза — статика без авторизации,
 * поэтому обычный fetch, а не apiFetch (нет Bearer/refresh-логики);
 * эталон потребления — браузерный fetch сайдбара сайта. Свою версию читаем
 * из нативного манифеста (nativeApplicationVersion = versionName из
 * app.json; в Expo Go это версия самого Expo Go — промпт там честно не
 * сработает). Все сбои — тихий fail-open: проверка не должна мешать входу.
 */
import { nativeApplicationVersion } from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Alert, Linking } from 'react-native';

import { APK_DOWNLOAD_URL, RELEASE_META_URL } from '@/config/env';
import { isNewerVersion, shouldPromptForUpdate } from '@/updates/version';

// Паттерн единого ключа (как AUTH_KEY в auth/tokens.ts), но значение —
// plain-строка: номер версии меты, на которую пользователь ответил отказом.
const DISMISSED_VERSION_KEY = 'update.dismissedVersion';

// Проверка уже выполнялась в этом процессе. Синхронный флаг ставится ДО
// первого await (паттерн sendInFlightRef из app/quick.tsx): повторные входы
// не делают второй запрос; при сбое fetch флаг НЕ сбрасываем — повтор
// случится следующим холодным стартом.
let checkedThisProcess = false;

// Мета новее установленной, найденная в этом процессе. Её показывает пункт
// «Скачать обновление» бургер-меню журнала — независимо от отказа:
// «Позже» глушит только стартовый диалог, не знание о доступном
// обновлении (решение показать пункт — тоже чистое поле isNewerVersion).
let availableVersion: string | null = null;

/** Только для тестов: сброс одноразовости «за процесс». */
export function __resetForTests(): void {
    checkedThisProcess = false;
    availableVersion = null;
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
 * Проверить обновление и, если мета новее и отказа на неё нет, показать
 * системный диалог. Возвращает версию доступного обновления (мета новее
 * установленной; null — нет/неизвестна): бургер-меню журнала рисует по ней
 * пункт «Скачать обновление». Отказ «Позже» на возвращаемое значение не
 * влияет. Все сбои — тихий fail-open: проверка не должна мешать входу.
 */
export async function maybePromptUpdate(): Promise<string | null> {
    if (checkedThisProcess) {
        return availableVersion;
    }

    checkedThisProcess = true;

    // 1. Мета: статика релизного JSON, из тела нужна только version;
    //    любые ошибки сети/статуса/разбора — тихий возврат.
    let metaVersion: string | null = null;

    try {
        const response = await fetch(RELEASE_META_URL, {
            headers: { Accept: 'application/json' },
        });

        if (response.ok) {
            const meta: unknown = await response.json();

            if (isRecord(meta) && typeof meta.version === 'string') {
                metaVersion = meta.version;
            }
        }
    } catch {
        return availableVersion;
    }

    // Битая мета — тупиковый путь: проверяем до readDismissed(), чтобы
    // не делать лишний I/O в SecureStore.
    if (metaVersion === null) {
        return availableVersion;
    }

    // Доступность для пункта меню — до учёта отказа (см. докблок выше).
    const installedVersion = nativeApplicationVersion ?? null;

    availableVersion =
        installedVersion !== null &&
        isNewerVersion(metaVersion, installedVersion)
            ? metaVersion
            : null;

    // 2. Решение чистым ядром: своя версия — из нативного манифеста
    //    (константа модуля, побочных эффектов у чтения нет).
    const dismissedVersion = await readDismissed();

    if (
        !shouldPromptForUpdate({
            metaVersion,
            installedVersion,
            dismissedVersion,
        })
    ) {
        return availableVersion;
    }

    // 3. Здесь metaVersion сужен до string — без приведения as string.
    promptDownload(metaVersion);

    return availableVersion;
}

/** Промпт обновления: «Скачать» открывает APK в браузере и ничего не
 *  сохраняет (пока версия меты не обновилась, следующий старт предложит
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
