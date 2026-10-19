/**
 * Диалог «Поддержать проект»: выбор банка сбора в Modal-карточке,
 * стилизованной под приложение (системный Alert с кнопками-банками
 * выглядел чужеродно). Кнопка банка закрывает диалог и открывает страницу
 * сбора в браузере; при недоступности (нет браузера/ссылки) — короткий
 * системный Alert (текст ошибки — не оформление, тут Alert уместен).
 */
import {
    Alert,
    Linking,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { colors, radius, spacing } from '@/theme/tokens';

/** Сборы добровольных пожертвований — внешние страницы, открываются
 *  в браузере устройства: Т-Банк и Сбер (ссылка Сбера — короткий адрес
 *  его мессенджера, счёт в банке иметь не обязательно). */
export const DONATE_URLS = [
    { label: 'Т-Банк', url: 'https://www.tbank.ru/cf/41k9RdG5ibo' },
    {
        label: 'Сбербанк',
        url: 'https://messenger.sbrf.ru/sl/4YhMIBtzuatnweYM0',
    },
];

/** Открыть страницу сбора в браузере; при недоступности (нет
 *  браузера/ссылки) — короткий Alert. */
async function openDonateUrl(url: string): Promise<void> {
    try {
        await Linking.openURL(url);
    } catch {
        Alert.alert('', 'Не удалось открыть страницу сбора.');
    }
}

export default function DonateDialog({
    visible,
    onClose,
}: {
    visible: boolean;
    onClose: () => void;
}) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <AppText variant="heading" style={styles.title}>
                        Поддержать проект
                    </AppText>
                    <AppText variant="label" color="muted" style={styles.hint}>
                        Выберите, куда перейти:
                    </AppText>

                    {DONATE_URLS.map((donate) => (
                        <OutlineButton
                            key={donate.url}
                            title={donate.label}
                            accessibilityLabel={`Поддержать проект — ${donate.label}`}
                            style={styles.bank}
                            onPress={() => {
                                onClose();
                                void openDonateUrl(donate.url);
                            }}
                        />
                    ))}

                    <Pressable
                        accessibilityRole="button"
                        style={styles.cancel}
                        onPress={onClose}
                    >
                        <AppText variant="label" color="muted">
                            Отмена
                        </AppText>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        alignItems: 'center',
        backgroundColor: colors.overlay,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.modal,
        padding: spacing.xl,
        width: '100%',
    },
    title: {
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    hint: {
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    bank: {
        marginBottom: spacing.sm,
    },
    cancel: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
});
