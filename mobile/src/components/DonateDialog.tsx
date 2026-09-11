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
    Text,
    View,
} from 'react-native';

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
                    <Text style={styles.title}>Поддержать проект</Text>
                    <Text style={styles.hint}>Выберите, куда перейти:</Text>

                    {DONATE_URLS.map((donate) => (
                        <Pressable
                            key={donate.url}
                            accessibilityRole="button"
                            accessibilityLabel={`Поддержать проект — ${donate.label}`}
                            style={styles.bank}
                            onPress={() => {
                                onClose();
                                void openDonateUrl(donate.url);
                            }}
                        >
                            <Text style={styles.bankLabel}>{donate.label}</Text>
                        </Pressable>
                    ))}

                    <Pressable
                        accessibilityRole="button"
                        style={styles.cancel}
                        onPress={onClose}
                    >
                        <Text style={styles.cancelLabel}>Отмена</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
    },
    title: {
        color: '#000',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
    },
    hint: {
        color: '#666',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    bank: {
        alignItems: 'center',
        borderColor: '#2f6fde',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        paddingVertical: 12,
    },
    bankLabel: {
        color: '#2f6fde',
        fontSize: 16,
        fontWeight: '600',
    },
    cancel: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    cancelLabel: {
        color: '#666',
        fontSize: 15,
    },
});
