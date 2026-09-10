import * as SecureStore from 'expo-secure-store';

import type { TokenPair } from '@/api/types';

// Один ключ = атомарная пара токенов + email; два ключа давали бы окно
// несогласованного состояния (зафиксированное отступление от PLAN.md:93).
const AUTH_KEY = 'auth.tokens';

export interface StoredAuth {
    access_token: string;
    refresh_token: string;
    email: string;
}

export async function readTokens(): Promise<StoredAuth | null> {
    try {
        const raw = await SecureStore.getItemAsync(AUTH_KEY);

        if (raw === null) {
            return null;
        }

        return JSON.parse(raw) as StoredAuth;
    } catch {
        // Битая или нечитаемая запись трактуется как «нет сессии» (anonymous).
        return null;
    }
}

export async function saveTokens(
    pair: TokenPair,
    email: string,
): Promise<void> {
    await SecureStore.setItemAsync(
        AUTH_KEY,
        JSON.stringify({
            access_token: pair.access_token,
            refresh_token: pair.refresh_token,
            email,
        }),
    );
}

export async function clearTokens(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(AUTH_KEY);
    } catch {
        // Отсутствие ключа и прочие ошибки удаления не должны ломать logout.
    }
}

/** Вызывается после успешной смены email на сервере (PATCH /profile):
 *  токены сохраняются, email заменяется, запись атомарна как у saveTokens.
 *  Осознанная гонка last-write-wins с идущим refresh — класс гонки, уже
 *  принятый в проекте; обе стороны оговорены:
 *  (а) завершившийся после смены refresh может записать старый email —
 *      он пишет email, прочитанный до запроса (client.ts performRefresh),
 *      и хранилище отстанет до следующего входа;
 *  (б) сам updateStoredEmail в окне read-modify-write может перезаписать
 *      свежеротированную refresh'ем пару токенов прежде прочитанной: старый
 *      refresh уже отозван, сессия закончится session-expired и
 *      перелогином — самолечимо. */
export async function updateStoredEmail(email: string): Promise<void> {
    const stored = await readTokens();

    if (stored === null) {
        // Сессии нет — обновлять нечего.
        return;
    }

    await SecureStore.setItemAsync(
        AUTH_KEY,
        JSON.stringify({ ...stored, email }),
    );
}
