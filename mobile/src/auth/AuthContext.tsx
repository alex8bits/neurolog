import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { onSessionExpired, resetSession } from '@/api/client';
import type { LoginInput, RegisterInput } from '@/api/types';
import { readTokens } from '@/auth/tokens';

export type AuthStatus = 'unknown' | 'anonymous' | 'authed';

export interface AuthUser {
    email: string;
}

interface AuthContextValue {
    status: AuthStatus;
    user: AuthUser | null;
    login: (input: LoginInput) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    logout: () => Promise<void>;
}

interface AuthState {
    status: AuthStatus;
    user: AuthUser | null;
}

const INITIAL_STATE: AuthState = { status: 'unknown', user: null };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>(INITIAL_STATE);

    // Bootstrap: сессия восстанавливается из SecureStore — рестарт
    // приложения не спрашивает логин повторно (PLAN.md, приёмка этапа 1).
    useEffect(() => {
        let cancelled = false;

        readTokens().then((stored) => {
            if (cancelled) {
                return;
            }

            setState(
                stored === null
                    ? { status: 'anonymous', user: null }
                    : { status: 'authed', user: { email: stored.email } },
            );
        });

        return () => {
            cancelled = true;
        };
    }, []);

    // Refresh-очередь клиента сама чистит токены при refresh-401 и зовёт
    // подписчиков (AuthController.php:81-85) — здесь только статус.
    useEffect(() => {
        const unsubscribe = onSessionExpired(() => {
            setState({ status: 'anonymous', user: null });
        });

        return unsubscribe;
    }, []);

    async function login(input: LoginInput): Promise<void> {
        // authApi.login сохраняет пару токенов; ApiError НЕ глотаем —
        // экран покажет сообщение формы/подсветку полей (таск 6).
        await authApi.login(input);
        setState({ status: 'authed', user: { email: input.email } });
    }

    async function register(input: RegisterInput): Promise<void> {
        await authApi.register(input);
        setState({ status: 'authed', user: { email: input.email } });
    }

    async function logout(): Promise<void> {
        // resetSession() ДО серверного вызова: инвалидируем «поколение»
        // очереди, чтобы идущий refresh не дописал пару токенов уже
        // после logout (дизайн, Risks — гонка logout vs refresh).
        resetSession();

        // authApi.logout — best-effort: сетевая ошибка серверного вызова
        // проглатывается внутри, токены чистятся в finally — смена
        // статуса происходит в любом случае.
        await authApi.logout();

        setState({ status: 'anonymous', user: null });
    }

    const value: AuthContextValue = { ...state, login, register, logout };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (context === null) {
        throw new Error('useAuth вызван вне <AuthProvider>.');
    }

    return context;
}
