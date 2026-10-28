import * as Network from 'expo-network';
import type { NetworkState } from 'expo-network';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { onNetworkOutcome } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { getSnapshot, useJournalStore } from '@/offline/journalStore';
import { flush, loadOwner } from '@/offline/sync';

interface ConnectivityValue {
    /** Есть сеть и последний API-вызов дошёл до сервера. */
    online: boolean;
    /** Записей в очереди, ждущих отправки. */
    pendingCount: number;
    /** Записей, отвергнутых сервером (422). */
    failedCount: number;
    /** Досылка очереди по требованию (pull-to-refresh и т.п.). */
    syncNow: () => void;
}

const ConnectivityContext = createContext<ConnectivityValue | null>(null);

const isConnected = (state: NetworkState) =>
    state.isConnected === true && state.isInternetReachable !== false;

const sameOwner = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Состояние связи и досылка очереди для всего приложения. Стоит в корневом
 * layout — обе иконки (журнал и «Приступ») проходят через него, поэтому
 * очередь уходит при любом запуске. Рендер детей ничем не блокирует.
 */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
    const { status, user } = useAuth();
    const store = useJournalStore();

    const [networkConnected, setNetworkConnected] = useState(true);
    const [apiReachable, setApiReachable] = useState(true);

    const email = status === 'authed' ? (user?.email ?? null) : null;

    // Для слушателей вне рендера: текущий владелец сессии.
    const emailRef = useRef<string | null>(email);

    // Объявлен первым — обновляется раньше эффектов ниже, читающих его.
    useEffect(() => {
        emailRef.current = email;
    }, [email]);

    // Досылать можно, только когда стор загружен для текущего владельца.
    const canSync = useCallback(() => {
        const owner = emailRef.current;
        const snapshot = getSnapshot();

        return (
            owner !== null &&
            snapshot.loaded &&
            snapshot.owner !== null &&
            sameOwner(snapshot.owner, owner)
        );
    }, []);

    const syncNow = useCallback(() => {
        if (canSync()) {
            void flush();
        }
    }, [canSync]);

    // Исходы API-вызовов: TypeError — офлайн, любой HTTP-ответ — онлайн.
    useEffect(() => onNetworkOutcome(setApiReachable), []);

    // Состояние сети: старт + слушатель; появление связи запускает досылку.
    useEffect(() => {
        let cancelled = false;
        let connectedBefore = true;

        const apply = (connected: boolean) => {
            if (cancelled) {
                return;
            }

            const cameOnline = connected && !connectedBefore;
            connectedBefore = connected;
            setNetworkConnected(connected);

            if (cameOnline) {
                // Сеть вернулась — снимаем прежний «сервер недоступен»;
                // первый же неудачный вызов выставит его снова.
                setApiReachable(true);
                syncNow();
            }
        };

        Network.getNetworkStateAsync().then(
            (state) => apply(isConnected(state)),
            (error: unknown) => {
                console.warn('connectivity: состояние сети не получено', error);
            },
        );

        const subscription = Network.addNetworkStateListener((state) =>
            apply(isConnected(state)),
        );

        return () => {
            cancelled = true;
            subscription.remove();
        };
    }, [syncNow]);

    // Возврат в приложение.
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                syncNow();
            }
        });

        return () => subscription.remove();
    }, [syncNow]);

    // Вход (в т.ч. холодный старт с сохранённой сессией) или смена
    // пользователя: загрузить стор владельца, затем дослать очередь.
    // Аноним — ничего: очистку данных решает явный выход.
    useEffect(() => {
        if (email === null) {
            return;
        }

        let cancelled = false;

        loadOwner(email).then(
            () => {
                if (!cancelled) {
                    syncNow();
                }
            },
            (error: unknown) => {
                console.warn('connectivity: стор не загружен', error);
            },
        );

        return () => {
            cancelled = true;
        };
    }, [email, syncNow]);

    const items = store.outbox?.items;

    const value = useMemo<ConnectivityValue>(() => {
        let pendingCount = 0;
        let failedCount = 0;

        for (const item of items ?? []) {
            if (item.state === 'failed') {
                failedCount += 1;
            } else {
                pendingCount += 1;
            }
        }

        return {
            online: networkConnected && apiReachable,
            pendingCount,
            failedCount,
            syncNow,
        };
    }, [items, networkConnected, apiReachable, syncNow]);

    return (
        <ConnectivityContext.Provider value={value}>
            {children}
        </ConnectivityContext.Provider>
    );
}

export function useConnectivity(): ConnectivityValue {
    const context = useContext(ConnectivityContext);

    if (context === null) {
        throw new Error('useConnectivity вызван вне <ConnectivityProvider>.');
    }

    return context;
}
