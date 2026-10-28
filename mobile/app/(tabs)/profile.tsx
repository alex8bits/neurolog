import { nativeApplicationVersion } from 'expo-application';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchProfile } from '@/api/profile';
import type { UserProfile } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import DonateDialog from '@/components/DonateDialog';
import { OfflinePlaceholder } from '@/components/OfflinePlaceholder';
import { AppText } from '@/components/ui/AppText';
import { APK_DOWNLOAD_URL } from '@/config/env';
import { useConnectivity } from '@/offline/ConnectivityContext';
import { colors, fontFamily, spacing } from '@/theme/tokens';
import { useAvailableUpdate } from '@/updates/useUpdateCheck';

/**
 * Вкладка «Профиль» (бывшее бургер-меню журнала): шапка с инициалом, имя и
 * email, пункты Настройки / Поддержать проект / Обратная связь и
 * «Скачать обновление» при найденной новой версии. «Выйти» живёт в
 * настройках. Без сети — заглушка; при возврате связи профиль
 * догружается, если ещё не был получен.
 */
export default function ProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { online } = useConnectivity();
    const { rememberName } = useAuth();

    // null = грузим (скелетон); ошибка меню не блокирует.
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [donateVisible, setDonateVisible] = useState(false);

    // Версия найденного обновления; null — нет/не проверено. Проверку
    // запускает useUpdateCheck в раскладке вкладок, здесь только чтение.
    const updateVersion = useAvailableUpdate();

    // Загрузка на монтирование и при возврате связи, пока профиля нет.
    const needProfile = profile === null;

    useEffect(() => {
        if (!online || !needProfile) {
            return;
        }

        let cancelled = false;

        fetchProfile()
            .then((response) => {
                if (!cancelled) {
                    setProfile(response.data);
                }

                // Имя для аватара журнала — свежее, чем в сохранённой сессии.
                void rememberName(response.data.name);
            })
            .catch(() => {
                // Шапка остаётся скелетоном, пункты работают.
            });

        return () => {
            cancelled = true;
        };
    }, [online, needProfile, rememberName]);

    function downloadUpdate(): void {
        void Linking.openURL(APK_DOWNLOAD_URL).catch(() => {
            Alert.alert('', 'Не удалось открыть страницу загрузки.');
        });
    }

    const initial = (profile?.name || profile?.email || '?')
        .charAt(0)
        .toUpperCase();

    const items: { key: string; label: string; onPress: () => void }[] = [
        {
            key: 'settings',
            label: 'Настройки',
            onPress: () => router.push('/(journal)/settings'),
        },
        {
            key: 'donate',
            label: 'Поддержать проект',
            onPress: () => setDonateVisible(true),
        },
        {
            key: 'feedback',
            label: 'Обратная связь',
            onPress: () => router.push('/(journal)/feedback'),
        },
    ];

    if (!online) {
        return <OfflinePlaceholder />;
    }

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[
                styles.content,
                { paddingTop: insets.top + spacing.sm },
            ]}
        >
            <AppText variant="title" style={styles.title}>
                Профиль
            </AppText>

            <View style={styles.head}>
                <View style={styles.avatar}>
                    <AppText color="primary" style={styles.avatarLabel}>
                        {initial}
                    </AppText>
                </View>
                <View style={styles.headText}>
                    {profile !== null ? (
                        <>
                            <AppText variant="heading" numberOfLines={1}>
                                {profile.name}
                            </AppText>
                            <AppText
                                variant="label"
                                color="muted"
                                numberOfLines={1}
                            >
                                {profile.email}
                            </AppText>
                        </>
                    ) : (
                        <>
                            <View style={[styles.skeleton, styles.skelName]} />
                            <View style={[styles.skeleton, styles.skelMail]} />
                        </>
                    )}
                </View>
            </View>

            <View style={styles.list}>
                {items.map((item) => (
                    <Pressable
                        key={item.key}
                        accessibilityRole="button"
                        style={styles.row}
                        onPress={item.onPress}
                    >
                        <AppText>{item.label}</AppText>
                    </Pressable>
                ))}
                {updateVersion !== null ? (
                    <Pressable
                        accessibilityRole="button"
                        style={styles.row}
                        onPress={downloadUpdate}
                    >
                        <AppText color="primary" style={styles.update}>
                            Скачать обновление ({updateVersion})
                        </AppText>
                    </Pressable>
                ) : null}
            </View>

            {nativeApplicationVersion ? (
                <AppText variant="caption" color="muted" style={styles.version}>
                    Версия {nativeApplicationVersion}
                </AppText>
            ) : null}

            <DonateDialog
                visible={donateVisible}
                onClose={() => setDonateVisible(false)}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    content: { paddingBottom: spacing.xxxl },
    title: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    head: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
    },
    avatar: {
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderRadius: 28,
        height: 56,
        justifyContent: 'center',
        width: 56,
    },
    avatarLabel: { fontFamily: fontFamily.extrabold, fontSize: 24 },
    headText: { flex: 1, gap: spacing.xs },
    skeleton: { backgroundColor: colors.strip0, borderRadius: 6, height: 14 },
    skelName: { width: '55%' },
    skelMail: { width: '75%' },
    list: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    row: {
        borderBottomColor: colors.line,
        borderBottomWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: spacing.lg,
    },
    update: { fontFamily: fontFamily.bold },
    version: { paddingTop: spacing.xl, textAlign: 'center' },
});
