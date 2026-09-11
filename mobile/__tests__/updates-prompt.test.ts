import * as SecureStore from 'expo-secure-store';
import { Alert, Linking } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { APK_DOWNLOAD_URL } from '@/config/env';
import { __resetForTests, maybePromptUpdate } from '@/updates/prompt';

vi.mock('expo-secure-store', () => ({
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
}));

// Установленная версия фиксируется моком: всем кейсам хватает '0.0.5';
// в SDK 57 у expo-application плоские именованные экспорты (без Application).
vi.mock('expo-application', () => ({
    nativeApplicationVersion: '0.0.5',
}));

vi.mock('react-native', () => ({
    Alert: { alert: vi.fn() },
    Linking: { openURL: vi.fn(() => Promise.resolve()) },
}));

const getItemAsync = SecureStore.getItemAsync as unknown as Mock<
    (key: string) => Promise<string | null>
>;
const setItemAsync = SecureStore.setItemAsync as unknown as Mock<
    (key: string, value: string) => Promise<void>
>;

interface PromptButton {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

type AlertAlert = (
    title: string,
    message: string,
    buttons: PromptButton[],
    options: { onDismiss?: () => void },
) => void;

const alertMock = Alert.alert as unknown as Mock<AlertAlert>;
const openURLMock = Linking.openURL as unknown as Mock<
    (url: string) => Promise<void>
>;

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** Мета 0.0.6 + установленная 0.0.5 + нет отказа — сценарий с промптом. */
function releaseMeta(): void {
    fetchMock.mockResolvedValue(jsonResponse(200, { version: '0.0.6' }));
}

beforeEach(() => {
    vi.resetAllMocks();
    __resetForTests();
    vi.stubGlobal('fetch', fetchMock);
    getItemAsync.mockResolvedValue(null);
    setItemAsync.mockResolvedValue(undefined);
    openURLMock.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('maybePromptUpdate', () => {
    it('мета новее установленной: один Alert с версией меты и двумя кнопками', async () => {
        releaseMeta();

        await maybePromptUpdate();

        expect(alertMock).toHaveBeenCalledTimes(1);

        const [title, message, buttons] = alertMock.mock.calls[0];

        expect(title).toBe('Обновление');
        expect(message).toContain('0.0.6');
        expect(buttons).toHaveLength(2);
        expect(buttons[0]).toMatchObject({ text: 'Позже', style: 'cancel' });
        expect(buttons[1]).toMatchObject({ text: 'Скачать' });
    });

    it('одноразовость: повтор без сброса не фетчит, после __resetForTests — фетчит', async () => {
        releaseMeta();

        await maybePromptUpdate();
        await maybePromptUpdate();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(alertMock).toHaveBeenCalledTimes(1);

        __resetForTests();

        await maybePromptUpdate();

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('сохранённый отказ для версии меты: fetch был, Alert не показан', async () => {
        getItemAsync.mockResolvedValue('0.0.6');
        releaseMeta();

        await maybePromptUpdate();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getItemAsync).toHaveBeenCalledWith('update.dismissedVersion');
        expect(alertMock).not.toHaveBeenCalled();
    });

    it('для пункта меню: возвращает доступную версию даже при сохранённом отказе', async () => {
        getItemAsync.mockResolvedValue('0.0.6');
        releaseMeta();

        // «Позже» глушит только стартовый диалог — бургер-меню всё равно
        // должно рисовать «Скачать обновление (0.0.6)».
        await expect(maybePromptUpdate()).resolves.toBe('0.0.6');
        expect(alertMock).not.toHaveBeenCalled();
    });

    it('версии равны: Alert не показан', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { version: '0.0.5' }));

        await maybePromptUpdate();

        expect(alertMock).not.toHaveBeenCalled();
    });

    it('мета без поля version / 404 / fetch reject: тихий возврат без Alert', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { apk: 'seizure.apk' }));

        await maybePromptUpdate();

        expect(alertMock).not.toHaveBeenCalled();

        __resetForTests();
        fetchMock.mockResolvedValue(
            jsonResponse(404, { message: 'Not Found' }),
        );

        await maybePromptUpdate();

        expect(alertMock).not.toHaveBeenCalled();

        __resetForTests();
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await expect(maybePromptUpdate()).resolves.toBeNull();
        expect(alertMock).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('кнопка «Скачать»: открывает APK_DOWNLOAD_URL и не сохраняет отказ', async () => {
        releaseMeta();

        await maybePromptUpdate();

        const [, , buttons] = alertMock.mock.calls[0];

        buttons[1].onPress?.();

        expect(openURLMock).toHaveBeenCalledTimes(1);
        expect(openURLMock).toHaveBeenCalledWith(APK_DOWNLOAD_URL);
        expect(setItemAsync).not.toHaveBeenCalled();
    });

    it('кнопка «Скачать» при неудаче Linking: fallback-Alert без заголовка', async () => {
        releaseMeta();

        await maybePromptUpdate();

        const [, , buttons] = alertMock.mock.calls[0];

        openURLMock.mockRejectedValueOnce(new Error('no activity'));

        buttons[1].onPress?.();

        await vi.waitFor(() => {
            expect(alertMock).toHaveBeenCalledTimes(2);
        });

        const [fallbackTitle, fallbackMessage] = alertMock.mock.calls[1];

        expect(fallbackTitle).toBe('');
        expect(fallbackMessage).toBe('Не удалось открыть страницу загрузки.');
    });

    it('кнопка «Позже»: сохраняет отказ для версии меты', async () => {
        releaseMeta();

        await maybePromptUpdate();

        const [, , buttons] = alertMock.mock.calls[0];

        buttons[0].onPress?.();

        expect(setItemAsync).toHaveBeenCalledTimes(1);
        expect(setItemAsync).toHaveBeenCalledWith(
            'update.dismissedVersion',
            '0.0.6',
        );
    });

    it('onDismiss (закрытие мимо кнопки): сохраняет отказ для версии меты', async () => {
        releaseMeta();

        await maybePromptUpdate();

        const [, , , options] = alertMock.mock.calls[0];

        options?.onDismiss?.();

        expect(setItemAsync).toHaveBeenCalledWith(
            'update.dismissedVersion',
            '0.0.6',
        );
    });
});
