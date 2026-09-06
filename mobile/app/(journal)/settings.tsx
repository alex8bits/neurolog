import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';

/**
 * Настройки — профиль-минимум (PLAN.md:118): email вошедшего и выход.
 * На API нет GET /user, смены пояса и 2FA (MOBILE.md:130) — экран ничего
 * не запрашивает и показывает только локально известный email.
 */
export default function SettingsScreen() {
    const { user, logout } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

    async function onLogout(): Promise<void> {
        // Гард сам уведёт на /(auth)/login после смены статуса
        // (перенос логики удалённого app/index.tsx).
        setLoggingOut(true);

        try {
            await logout();
        } finally {
            setLoggingOut(false);
        }
    }

    return (
        <View style={styles.screen}>
            <Text style={styles.email}>Вы вошли как {user?.email ?? '—'}</Text>

            <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: loggingOut }}
                style={[styles.logout, loggingOut && styles.logoutDisabled]}
                disabled={loggingOut}
                onPress={onLogout}
            >
                <Text style={styles.logoutLabel}>
                    {loggingOut ? 'Выходим…' : 'Выйти'}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    email: {
        color: '#333',
        fontSize: 15,
        marginBottom: 24,
        textAlign: 'center',
    },
    logout: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingVertical: 12,
    },
    logoutDisabled: {
        opacity: 0.6,
    },
    logoutLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
