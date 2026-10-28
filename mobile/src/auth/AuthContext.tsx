import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import type { ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { onSessionExpired, resetSession } from '@/api/client';
import { fetchProfile } from '@/api/profile';
import type { LoginInput, RegisterInput } from '@/api/types';
import {
    clearTokens,
    readTokens,
    updateStoredEmail,
    updateStoredName,
} from '@/auth/tokens';
import { clearStore, renameOwner } from '@/offline/journalStore';
import { loadOwner } from '@/offline/sync';

export type AuthStatus = 'unknown' | 'anonymous' | 'authed';

export interface AuthUser {
    email: string;
    /** null — имя ещё не известно (вход до первого GET /profile). */
    name: string | null;
}

interface AuthContextValue {
    status: AuthStatus;
    user: AuthUser | null;
    login: (input: LoginInput) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    logout: () => Promise<void>;
    updateEmail: (email: string) => Promise<void>;
    rememberName: (name: string) => Promise<void>;
    signOutLocally: () => Promise<void>;
}

interface AuthState {
    status: AuthStatus;
    user: AuthUser | null;
}

const INITIAL_STATE: AuthState = { status: 'unknown', user: null };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>(INITIAL_STATE);

    /** Запоминает имя (SecureStore + состояние) — его зовут экраны,
     *  получившие профиль с сервера. */
    const rememberName = useCallback(async (name: string): Promise<void> => {
        try {
            await updateStoredName(name);
        } catch (error) {
            console.warn('auth: имя не сохранено', error);
        }

        setState((prev) =>
            prev.user === null || prev.user.name === name
                ? prev
                : { ...prev, user: { ...prev.user, name } },
        );
    }, []);

    /** Имя для аватара после входа: best-effort GET /profile — без сети
     *  аватар показывает букву email, имя подтянут экраны профиля. */
    const loadName = useCallback((): void => {
        fetchProfile().then(
            (response) => void rememberName(response.data.name),
            () => {},
        );
    }, [rememberName]);

    // Bootstrap: сессия восстанавливается из SecureStore — рестарт
    // приложения не спрашивает логин повторно (PLAN.md, приёмка этапа 1).
    useEffect(() => {
        let cancelled = false;

        readTokens().then((stored) => {
            if (cancelled) {
                return;
            }

            if (stored === null) {
                setState({ status: 'anonymous', user: null });

                return;
            }

            setState({
                status: 'authed',
                user: { email: stored.email, name: stored.name ?? null },
            });

            if (stored.name === undefined) {
                loadName();
            }
        });

        return () => {
            cancelled = true;
        };
    }, [loadName]);

    // Refresh-очередь клиента сама чистит токены при refresh-401 и зовёт
    // подписчиков (AuthController.php:81-85) — здесь только статус.
    // Локальный журнал и очередь НЕ стираются: после входа тем же email
    // неотправленные записи уйдут на сервер (вход другим email их сотрёт
    // через loadStore).
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
        setState({
            status: 'authed',
            user: { email: input.email, name: null },
        });
        loadName();
    }

    async function register(input: RegisterInput): Promise<void> {
        await authApi.register(input);
        setState({
            status: 'authed',
            user: { email: input.email, name: input.name },
        });
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

        // Явный выход стирает журнал и очередь с телефона (предупреждение о
        // неотправленных — на экране настроек).
        await clearLocalData();

        setState({ status: 'anonymous', user: null });
    }

    /** После успешной смены email (PATCH /profile): новый email пишется и
     *  в SecureStore, и в состояние — «Вы вошли как» не устаревает.
     *
     *  Локальный стор переименовывается ДО смены user.email: провайдер
     *  связи на новый email зовёт loadOwner, и если бы стор ещё числился
     *  за старым email, loadStore удалил бы кэш и очередь как чужие.
     *  renameOwner меняет владельца в памяти синхронно, поэтому к моменту
     *  setState стор уже «новый» и loadOwner его не перечитывает. Если
     *  стор ещё грузится (холодный старт), сначала дожидаемся загрузки
     *  под прежним email. */
    async function updateEmail(email: string): Promise<void> {
        await updateStoredEmail(email);

        const previous = state.user?.email ?? null;

        if (previous !== null) {
            try {
                await loadOwner(previous);
                await renameOwner(email);
            } catch (error) {
                console.warn('auth: локальный журнал не переименован', error);
            }
        }

        setState((prev) =>
            prev.user === null
                ? prev
                : { ...prev, user: { ...prev.user, email } },
        );
    }

    /** Локальный выход без серверного вызова — используется после
     *  DELETE /profile: сервер уже отозвал токены, повторный /logout не
     *  нужен (гнал бы бессмысленные запросы отозванными токенами). */
    async function signOutLocally(): Promise<void> {
        // resetSession() ДО очистки: инвалидируем «поколение» очереди, как
        // в logout(), — идущий refresh не дописал бы токены после очистки.
        resetSession();

        await clearTokens();

        await clearLocalData();

        setState({ status: 'anonymous', user: null });
    }

    /** Стирает кэш журнала и очередь; сбой файловой системы не мешает
     *  выходу (loadStore следующего владельца всё равно удалит чужие
     *  файлы). */
    async function clearLocalData(): Promise<void> {
        try {
            await clearStore();
        } catch (error) {
            console.warn('auth: локальный журнал не удалён', error);
        }
    }

    const value: AuthContextValue = {
        ...state,
        login,
        register,
        logout,
        updateEmail,
        rememberName,
        signOutLocally,
    };

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
