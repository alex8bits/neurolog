import { apiFetch } from '@/api/client';
import type { LoginInput, RegisterInput, TokenResponse } from '@/api/types';
import { clearTokens, saveTokens } from '@/auth/tokens';
import { deviceTimezone } from '@/config/timezone';

export async function register(input: RegisterInput): Promise<void> {
    const response = await apiFetch<TokenResponse>('/register', {
        method: 'POST',
        auth: false,
        body: {
            name: input.name,
            email: input.email,
            password: input.password,
            password_confirmation: input.password,
            timezone: deviceTimezone(),
        },
    });

    await saveTokens(response.data, input.email, input.name);
}

export async function login(input: LoginInput): Promise<void> {
    const response = await apiFetch<TokenResponse>('/login', {
        method: 'POST',
        auth: false,
        body: { email: input.email, password: input.password },
    });

    await saveTokens(response.data, input.email);
}

export async function logout(): Promise<void> {
    try {
        await apiFetch('/logout', { method: 'POST' }); // защищённый: Bearer + очередь при 401
    } catch {
        // best-effort: сервер недоступен — локальную сессию всё равно чистим
    } finally {
        await clearTokens();
    }
}
