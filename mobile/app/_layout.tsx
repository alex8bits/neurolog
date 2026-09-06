import {
    Stack,
    useGlobalSearchParams,
    useRouter,
    useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/auth/AuthContext';

/** Белый список returnTo: параметр внутренний, его ставит только само приложение. */
const RETURN_TO_WHITELIST = ['/quick'] as const;

/** Валидное значение returnTo — литерал из белого списка. */
type ReturnTo = (typeof RETURN_TO_WHITELIST)[number];

/**
 * Проверка query-параметра по белому списку: массив (повторённый в URL
 * параметр), undefined и мусор не проходят — только строка-литерал.
 */
function isAllowedReturnTo(
    value: string | string[] | undefined,
): value is ReturnTo {
    return (
        typeof value === 'string' &&
        (RETURN_TO_WHITELIST as readonly string[]).includes(value)
    );
}

/**
 * Роутинг-гард (канон expo-router): до bootstrap ничего не рендерим,
 * анонима держим в группе (auth), аутентифицированного из неё выводим.
 * Аноним с /quick уходит на логин с returnTo=/quick, а после успеха
 * гард возвращает по белому списку в /quick — иначе поведение прежнее.
 */
function AppGuard({ children }: { children: ReactNode }) {
    const { status } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    // Только глобальные параметры: у корневого layout свои local-параметры
    // всегда пусты (они проставляются лишь deepest route).
    const params = useGlobalSearchParams();

    useEffect(() => {
        if (status === 'unknown') {
            return;
        }

        const inAuthGroup = segments[0] === '(auth)';

        if (status === 'anonymous' && !inAuthGroup) {
            if (segments[0] === 'quick') {
                // Быстрая ветка: после логина обязаны вернуться к записи,
                // а не в журнал.
                router.replace({
                    pathname: '/(auth)/login',
                    params: { returnTo: '/quick' },
                });
            } else {
                router.replace('/(auth)/login');
            }
        } else if (status === 'authed' && inAuthGroup) {
            // Возврат после логина — только по белому списку, иначе журнал.
            const returnTo = isAllowedReturnTo(params.returnTo)
                ? params.returnTo
                : '/';

            router.replace(returnTo);
        }
    }, [status, segments, router, params.returnTo]);

    if (status === 'unknown') {
        return null; // ничего не рендерим до bootstrap — без «мигания» логина
    }

    return <>{children}</>;
}

export default function RootLayout() {
    return (
        <AuthProvider>
            <AppGuard>
                <Stack screenOptions={{ headerShown: false }}>
                    {/* /quick — без жеста «назад»: под ним на тёплом старте
                        может лежать журнал, который нельзя показывать. */}
                    <Stack.Screen
                        name="quick"
                        options={{ gestureEnabled: false }}
                    />
                </Stack>
                <StatusBar style="auto" />
            </AppGuard>
        </AuthProvider>
    );
}
