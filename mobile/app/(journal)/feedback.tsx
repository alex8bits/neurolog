import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sendFeedback } from '@/api/feedback';
import { fetchProfile } from '@/api/profile';
import { ApiError, userMessage } from '@/utils/errors';

const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** Серверные лимиты полей формы (FeedbackValidationRules). */
const NAME_MAX_LENGTH = 255;
const EMAIL_MAX_LENGTH = 255;
const MESSAGE_MAX_LENGTH = 5000;

/**
 * Обратная связь — маршрут /feedback группы (journal), открывается из
 * бургер-меню журнала. Имя и почта предзаполняются из GET /profile, но
 * редактируемы: в обращении уходит то, что в полях. Флаг «анонимное
 * обращение» глушит оба поля (на сервер всё равно не уходят) — письмо
 * владельцу несёт только текст. Отправка POST /feedback: 422 мапится в
 * подсветку полей, успех — алерт и возврат в журнал.
 */
export default function FeedbackScreen() {
    const router = useRouter();

    // Отступ статус-бара: контент начинается под часами/уведомлениями.
    const insets = useSafeAreaInsets();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );

    // Префилл из профиля: фоновая загрузка, отмена через cancelled-флаг
    // (паттерн bootstrap-эффекта AuthContext). Пока едет — поля пустые,
    // форма уже работоспособна.
    useEffect(() => {
        let cancelled = false;

        fetchProfile().then(
            (response) => {
                if (cancelled) {
                    return;
                }

                setName(response.data.name);
                setEmail(response.data.email);
            },
            () => {
                // Профиль не загрузился — поля остаются пустыми, вводим
                // руками: обратная связь не должна зависеть от /profile.
            },
        );

        return () => {
            cancelled = true;
        };
    }, []);

    /** Ввод после ошибки: чистим сообщение и запись поля. */
    function clearError(field: string): void {
        setFormError(null);

        setFieldErrors((prev) => {
            if (!(field in prev)) {
                return prev;
            }

            const next = { ...prev };

            delete next[field];

            return next;
        });
    }

    /** Чекбокс «анонимное обращение»: коробка с галочкой + подпись. */
    function renderAnonymousToggle(): React.ReactElement {
        return (
            <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: anonymous }}
                style={styles.checkboxRow}
                onPress={() => {
                    setAnonymous((value) => !value);
                }}
            >
                <View
                    style={[
                        styles.checkboxBox,
                        anonymous && styles.checkboxBoxChecked,
                    ]}
                >
                    {anonymous ? (
                        <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                </View>
                <Text style={styles.checkboxLabel}>Анонимное обращение</Text>
            </Pressable>
        );
    }

    /** «Отправить»: клиентски проверяем непустоту (без анонимного флага —
     *  и имя с почтой), дальше POST; успех — алерт и назад в журнал. */
    async function onSubmit(): Promise<void> {
        const errors: Record<string, string[]> = {};

        if (!anonymous) {
            if (name.trim() === '') {
                errors.name = ['Введите имя.'];
            }

            if (email.trim() === '') {
                errors.email = ['Введите email.'];
            }
        }

        if (message.trim() === '') {
            errors.message = ['Введите текст обращения.'];
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setFormError(null);

            return;
        }

        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        try {
            const confirmation = await sendFeedback({
                anonymous,
                name: name.trim(),
                email: email.trim(),
                message: message.trim(),
            });

            Alert.alert('', confirmation, [
                { text: 'Ок', onPress: () => router.back() },
            ]);
        } catch (error) {
            if (
                error instanceof ApiError &&
                error.kind === 'validation' &&
                error.fieldErrors !== undefined &&
                Object.keys(error.fieldErrors).length > 0
            ) {
                setFieldErrors(error.fieldErrors);
            } else {
                setFormError(
                    error instanceof ApiError
                        ? userMessage(error)
                        : GENERIC_ERROR_TEXT,
                );
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.screen}>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: insets.top + 16,
                        paddingBottom: insets.bottom + 16,
                    },
                ]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.field}>
                    <Text style={styles.label}>Имя</Text>
                    <TextInput
                        style={[
                            styles.input,
                            !anonymous &&
                                fieldErrors.name &&
                                styles.inputInvalid,
                            anonymous && styles.inputDisabled,
                        ]}
                        value={name}
                        onChangeText={(value) => {
                            setName(value);
                            clearError('name');
                        }}
                        accessibilityLabel="Имя"
                        editable={!anonymous}
                        maxLength={NAME_MAX_LENGTH}
                    />
                    {!anonymous && fieldErrors.name ? (
                        <Text style={styles.fieldError}>
                            {fieldErrors.name.join(' ')}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Почта</Text>
                    <TextInput
                        style={[
                            styles.input,
                            !anonymous &&
                                fieldErrors.email &&
                                styles.inputInvalid,
                            anonymous && styles.inputDisabled,
                        ]}
                        value={email}
                        onChangeText={(value) => {
                            setEmail(value);
                            clearError('email');
                        }}
                        accessibilityLabel="Почта"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!anonymous}
                        maxLength={EMAIL_MAX_LENGTH}
                    />
                    {!anonymous && fieldErrors.email ? (
                        <Text style={styles.fieldError}>
                            {fieldErrors.email.join(' ')}
                        </Text>
                    ) : null}
                </View>

                {renderAnonymousToggle()}
                <Text style={styles.checkboxHint}>
                    С флагом отправляется только текст обращения — без имени и
                    почты.
                </Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Текст обращения</Text>
                    <TextInput
                        style={[
                            styles.input,
                            styles.messageInput,
                            fieldErrors.message && styles.inputInvalid,
                        ]}
                        value={message}
                        onChangeText={(value) => {
                            setMessage(value);
                            clearError('message');
                        }}
                        accessibilityLabel="Текст обращения"
                        multiline
                        maxLength={MESSAGE_MAX_LENGTH}
                        textAlignVertical="top"
                    />
                    {fieldErrors.message ? (
                        <Text style={styles.fieldError}>
                            {fieldErrors.message.join(' ')}
                        </Text>
                    ) : null}
                </View>

                {formError ? (
                    <Text style={styles.formError}>{formError}</Text>
                ) : null}

                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitting }}
                    style={[styles.submit, submitting && styles.actionDisabled]}
                    disabled={submitting}
                    onPress={onSubmit}
                >
                    <Text style={styles.submitLabel}>
                        {submitting ? 'Отправляем…' : 'Отправить'}
                    </Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        color: '#333',
        fontSize: 15,
        marginBottom: 6,
    },
    input: {
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    inputInvalid: {
        borderColor: '#d32f2f',
    },
    inputDisabled: {
        opacity: 0.5,
    },
    messageInput: {
        minHeight: 120,
    },
    fieldError: {
        color: '#d32f2f',
        fontSize: 13,
        marginTop: 4,
    },
    checkboxRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 4,
    },
    checkboxBox: {
        alignItems: 'center',
        borderColor: '#2f6fde',
        borderRadius: 4,
        borderWidth: 1,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    checkboxBoxChecked: {
        backgroundColor: '#2f6fde',
    },
    checkboxMark: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    checkboxLabel: {
        color: '#000',
        fontSize: 16,
    },
    checkboxHint: {
        color: '#666',
        fontSize: 14,
        marginBottom: 16,
        marginTop: 4,
    },
    formError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    actionDisabled: {
        opacity: 0.6,
    },
    submit: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingVertical: 12,
    },
    submitLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
