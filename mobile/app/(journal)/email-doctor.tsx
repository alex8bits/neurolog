import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { emailSeizuresDoctor } from '@/api/seizures';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { deviceTimezone } from '@/config/timezone';
import { colors, spacing } from '@/theme/tokens';
import { ApiError, userMessage } from '@/utils/errors';

/** Серверные лимиты письма (Api/V1/EmailDoctorRequest.php): to/subject —
 *  max:255, body — max:5000. */
const RECIPIENT_MAX_LENGTH = 255;
const SUBJECT_MAX_LENGTH = 255;
const BODY_MAX_LENGTH = 5000;

/** Роут-параметры от экрана журнала — текущий фильтр периода; значения
 *  теоретически массивы (повтор имени параметра) — сужаем firstParam-ом.
 *  Параметр to — дата конца периода, получатель письма — поле recipient. */
type EmailDoctorParams = {
    from?: string | string[];
    to?: string | string[];
    timezone?: string | string[];
};

/** Первое значение роут-параметра; отсутствующий — пустая строка. */
function firstParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }

    return value ?? '';
}

/**
 * Письмо доктору — маршрут /email-doctor группы (journal): форма
 * Кому/Тема/Текст, отправка через POST /seizures/email-doctor — журнал за
 * период прикладывается DOCX-отчётом. Период приходит роут-параметрами от
 * экрана журнала: timezone (IANA; без параметра — пояс устройства) и
 * границы from/to (Y-m-d; без границ — весь журнал). Валидация —
 * серверная: 422 мапится в fieldErrors (errors.to|subject|body
 * подсвечивают поля), email регуляркой на клиенте не проверяем. Пустые
 * тема/текст уходят undefined — сервер подставит значения по умолчанию.
 * После 200 Alert с message сервера и возврат назад; отмена — системная
 * «назад» (стрелка нативного заголовка), отдельной кнопки нет.
 */
export default function EmailDoctorScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<EmailDoctorParams>();

    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );

    /** Ввод после ошибки: чистим сообщение формы и запись поля. */
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

    /** Маппинг ApiError на состояние экрана: validation — подсветка полей
     *  письма, остальное — сообщение формы. */
    function applyError(error: unknown): void {
        if (error instanceof ApiError) {
            if (
                error.kind === 'validation' &&
                error.fieldErrors !== undefined &&
                Object.keys(error.fieldErrors).length > 0
            ) {
                setFieldErrors(error.fieldErrors);

                return;
            }

            setFormError(userMessage(error));

            return;
        }

        // Неожиданная ошибка — не крашимся, показываем общий текст.
        setFormError('Сервер недоступен, попробуйте позже.');
    }

    // Клиентских проверок нет — сервер источник истины (422 подсветит
    // поля); повторный сабмит блокирует submitting, длину режет maxLength.
    async function onSubmit(): Promise<void> {
        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        try {
            const timezone = firstParam(params.timezone) || deviceTimezone();
            const from = firstParam(params.from);
            const to = firstParam(params.to);

            const response = await emailSeizuresDoctor(
                {
                    timezone,
                    ...(from ? { from } : {}),
                    ...(to ? { to } : {}),
                },
                {
                    to: recipient.trim(),
                    subject: subject.trim() || undefined,
                    body: body.trim() || undefined,
                },
            );

            Alert.alert(
                'Отправлено',
                response.message,
                [
                    {
                        text: 'Ок',
                        onPress: () => {
                            router.back();
                        },
                    },
                ],
                // На Android без cancelable: false алерт закрывается тапом
                // вне/back, оставляя на экране уже отправленную форму.
                { cancelable: false },
            );
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.screen}>
            <TextField
                label="Кому"
                placeholder="Адрес получателя"
                value={recipient}
                onChangeText={(value) => {
                    setRecipient(value);
                    clearError('to');
                }}
                error={fieldErrors.to?.join(' ')}
                accessibilityLabel="Кому"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={RECIPIENT_MAX_LENGTH}
            />

            <TextField
                label="Тема"
                placeholder="Тема (необязательно)"
                value={subject}
                onChangeText={(value) => {
                    setSubject(value);
                    clearError('subject');
                }}
                error={fieldErrors.subject?.join(' ')}
                accessibilityLabel="Тема"
                maxLength={SUBJECT_MAX_LENGTH}
            />

            <TextField
                label="Текст письма"
                placeholder="Текст письма (необязательно)"
                value={body}
                multiline
                onChangeText={(value) => {
                    setBody(value);
                    clearError('body');
                }}
                error={fieldErrors.body?.join(' ')}
                style={styles.bodyInput}
                accessibilityLabel="Текст письма"
                maxLength={BODY_MAX_LENGTH}
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
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.surface,
        flex: 1,
        paddingHorizontal: spacing.xxl,
        paddingTop: spacing.lg,
    },
    bodyInput: {
        minHeight: 96,
        textAlignVertical: 'top',
    },
    formError: {
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    submit: {
        marginTop: spacing.xs,
    },
});
