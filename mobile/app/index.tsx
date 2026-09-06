import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';

/**
 * Индикатор сессии — поверхность ручной приёмки этапа 1
 * (PLAN.md:100); в этапе 2 заменится журналом.
 */
export default function Home() {
    const { status, user, logout } = useAuth();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    async function onLogout(): Promise<void> {
        // Гард сам уведёт на /(auth)/login после смены статуса.
        setLoggingOut(true);

        try {
            await logout();
        } finally {
            setLoggingOut(false);
        }
    }

    // anonymous здесь теоретически недостижим (гард редиректит),
    // но экран не должен падать.
    if (status !== 'authed') {
        return (
            <View style={styles.screen}>
                <Text style={styles.title}>График приступов</Text>
                <Text style={styles.statusText}>Вы не авторизованы</Text>
                <Pressable
                    accessibilityRole="link"
                    style={styles.link}
                    onPress={() => router.push('/(auth)/login')}
                >
                    <Text style={styles.linkLabel}>Войти</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>График приступов</Text>
            <Text style={styles.statusText}>Вы вошли как {user?.email}</Text>
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
        alignItems: 'center',
        backgroundColor: '#fff',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        color: '#000',
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    statusText: {
        color: '#333',
        fontSize: 16,
        marginBottom: 24,
        textAlign: 'center',
    },
    logout: {
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 32,
    },
    logoutDisabled: {
        opacity: 0.6,
    },
    logoutLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    link: {
        marginTop: 8,
    },
    linkLabel: {
        color: '#2f6fde',
        fontSize: 15,
    },
});
