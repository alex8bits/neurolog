import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/auth/AuthContext';

/**
 * Роутинг-гард (канон expo-router): до bootstrap ничего не рендерим,
 * анонима держим в группе (auth), аутентифицированного из неё выводим.
 */
function AppGuard({ children }: { children: ReactNode }) {
    const { status } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unknown') {
            return;
        }

        const inAuthGroup = segments[0] === '(auth)';

        if (status === 'anonymous' && !inAuthGroup) {
            router.replace('/(auth)/login');
        } else if (status === 'authed' && inAuthGroup) {
            router.replace('/');
        }
    }, [status, segments, router]);

    if (status === 'unknown') {
        return null; // ничего не рендерим до bootstrap — без «мигания» логина
    }

    return <>{children}</>;
}

export default function RootLayout() {
    return (
        <AuthProvider>
            <AppGuard>
                <Stack screenOptions={{ headerShown: false }} />
                <StatusBar style="auto" />
            </AppGuard>
        </AuthProvider>
    );
}
