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
