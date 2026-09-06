import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { createSeizure } from '@/api/seizures';
import { deviceTimezone } from '@/config/timezone';
import { ApiError, userMessage } from '@/utils/errors';

/** Серверный лимит комментария: comment nullable|string|max:2000. */
const COMMENT_MAX_LENGTH = 2000;

/**
 * Запись приступа «сейчас»: время не вводится — сервер ставит текущий
 * момент UTC сам (occurred_at не шлём), пояс берём устройства. После 201
 * уходим назад — список перечитается фокус-эффектом экрана журнала.
 */
export default function NewSeizureScreen() {
    const router = useRouter();

    const [comment, setComment] = useState('');
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

    /** Маппинг ApiError на состояние экрана: validation — подсветка
     *  поля comment, остальное — сообщение формы. */
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

    // Клиентской валидации нет: обязательных полей нет, длина
    // ограничена maxLength самого TextInput.
    async function onSubmit(): Promise<void> {
        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        try {
            await createSeizure({
                timezone: deviceTimezone(),
                comment: comment.trim() === '' ? undefined : comment.trim(),
            });

            router.back();
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.screen}>
            <Text style={styles.hint}>Будет записано текущее время</Text>

            <View style={styles.field}>
                <TextInput
                    style={[
                        styles.input,
                        fieldErrors.comment && styles.inputInvalid,
                    ]}
                    value={comment}
                    multiline
                    onChangeText={(value) => {
                        setComment(value);
                        clearError('comment');
                    }}
                    placeholder="Комментарий (необязательно)"
                    maxLength={COMMENT_MAX_LENGTH}
                />
                {fieldErrors.comment ? (
                    <Text style={styles.fieldError}>
                        {fieldErrors.comment.join(' ')}
                    </Text>
                ) : null}
                <Text style={styles.counter}>
                    {comment.length}/{COMMENT_MAX_LENGTH}
                </Text>
            </View>

            {formError ? (
                <Text style={styles.formError}>{formError}</Text>
            ) : null}

            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    style={styles.cancel}
                    onPress={() => {
                        router.back();
                    }}
                >
                    <Text style={styles.cancelLabel}>Отменить</Text>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitting }}
                    style={[styles.submit, submitting && styles.submitDisabled]}
                    disabled={submitting}
                    onPress={onSubmit}
                >
                    <Text style={styles.submitLabel}>
                        {submitting ? 'Записываем…' : 'Записать'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    hint: {
        color: '#333',
        fontSize: 14,
        marginBottom: 12,
    },
    field: {
        marginBottom: 16,
    },
    input: {
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 16,
        minHeight: 96,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    inputInvalid: {
        borderColor: '#d32f2f',
    },
    fieldError: {
        color: '#d32f2f',
        fontSize: 13,
        marginTop: 4,
    },
    counter: {
        color: '#333',
        fontSize: 13,
        marginTop: 4,
        textAlign: 'right',
    },
    formError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancel: {
        alignItems: 'center',
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        paddingVertical: 12,
    },
    cancelLabel: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    submit: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        flex: 1,
        paddingVertical: 12,
    },
    submitDisabled: {
        opacity: 0.6,
    },
    submitLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
