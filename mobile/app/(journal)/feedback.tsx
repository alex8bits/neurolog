import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sendFeedback } from '@/api/feedback';
import { fetchProfile } from '@/api/profile';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { colors, radius, spacing } from '@/theme/tokens';
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
                        <AppText variant="label" color="white">
                            ✓
                        </AppText>
                    ) : null}
                </View>
                <AppText variant="body">Анонимное обращение</AppText>
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
                        paddingTop: insets.top + spacing.lg,
                        paddingBottom: insets.bottom + spacing.lg,
                    },
                ]}
                keyboardShouldPersistTaps="handled"
            >
                <TextField
                    label="Имя"
                    value={name}
                    onChangeText={(value) => {
                        setName(value);
                        clearError('name');
                    }}
                    error={!anonymous ? fieldErrors.name?.join(' ') : null}
                    accessibilityLabel="Имя"
                    editable={!anonymous}
                    maxLength={NAME_MAX_LENGTH}
                    containerStyle={anonymous ? styles.disabled : undefined}
                />

                <TextField
                    label="Почта"
                    value={email}
                    onChangeText={(value) => {
                        setEmail(value);
                        clearError('email');
                    }}
                    error={!anonymous ? fieldErrors.email?.join(' ') : null}
                    accessibilityLabel="Почта"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!anonymous}
                    maxLength={EMAIL_MAX_LENGTH}
                    containerStyle={anonymous ? styles.disabled : undefined}
                />

                {renderAnonymousToggle()}
                <AppText
                    variant="label"
                    color="muted"
                    style={styles.checkboxHint}
                >
                    С флагом отправляется только текст обращения — без имени и
                    почты.
                </AppText>

                <TextField
                    label="Текст обращения"
                    value={message}
                    onChangeText={(value) => {
                        setMessage(value);
                        clearError('message');
                    }}
                    error={fieldErrors.message?.join(' ')}
                    style={styles.messageInput}
                    accessibilityLabel="Текст обращения"
                    multiline
                    maxLength={MESSAGE_MAX_LENGTH}
                    textAlignVertical="top"
                />

                {formError ? (
                    <AppText
                        variant="label"
                        color="danger"
                        style={styles.formError}
                    >
                        {formError}
                    </AppText>
                ) : null}

                <PrimaryButton
                    title={submitting ? 'Отправляем…' : 'Отправить'}
                    disabled={submitting}
                    onPress={onSubmit}
                    style={styles.submit}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.surface,
        flex: 1,
    },
    content: {
        paddingHorizontal: spacing.xxl,
    },
    disabled: {
        opacity: 0.5,
    },
    messageInput: {
        minHeight: 120,
    },
    checkboxRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md - 2,
        marginBottom: spacing.xs,
    },
    checkboxBox: {
        alignItems: 'center',
        borderColor: colors.primary,
        borderRadius: radius.cell - 1,
        borderWidth: 1.5,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    checkboxBoxChecked: {
        backgroundColor: colors.primary,
    },
    checkboxHint: {
        marginBottom: spacing.lg,
        marginTop: spacing.xs,
    },
    formError: {
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    submit: {
        marginTop: spacing.xs,
    },
});
