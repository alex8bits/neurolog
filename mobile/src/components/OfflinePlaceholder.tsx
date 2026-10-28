import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { colors, spacing } from '@/theme/tokens';

/**
 * Заглушка вкладок, которым нужен сервер («Отчёт», «Профиль»), когда связь
 * пропала при открытом экране. Вкладки офлайн и так не открываются — это
 * на случай, если экран уже был показан.
 */
export function OfflinePlaceholder() {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.body}>
                <AppText variant="heading" style={styles.text}>
                    Нужно подключение к интернету
                </AppText>
                <AppText color="muted" style={styles.text}>
                    Журнал и запись приступов работают без сети.
                </AppText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    body: {
        flex: 1,
        gap: spacing.sm,
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
    },
    text: { textAlign: 'center' },
});
