import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { ApiError, userMessage } from '@/utils/errors';

/**
 * Экран входа. После успешного login ничего не навигируем —
 * гард в app/_layout.tsx сам уведёт с группы (auth).
 */
export default function LoginScreen() {
    const { login } = useAuth();
    const router = useRouter();
    // Пришли из быстрой ветки (/quick) — параметр переживёт и регистрацию.
    const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
     *  полей (422 с errors.<field>), остальное — сообщение формы. */
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

    async function onSubmit(): Promise<void> {
        const errors: Record<string, string[]> = {};

        if (email.trim() === '') {
            errors.email = ['Введите email.'];
        }

        if (password === '') {
            errors.password = ['Введите пароль.'];
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
            await login({ email: email.trim(), password });
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    /** Перекрёстная ссылка на регистрацию: форвардим returnTo, если он есть. */
    function goToRegister(): void {
        if (returnTo !== undefined) {
            router.push({
                pathname: '/(auth)/register',
                params: { returnTo },
            });
        } else {
            router.push('/(auth)/register');
        }
    }

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Вход</Text>

            <View style={styles.field}>
                <TextInput
                    style={[
                        styles.input,
                        fieldErrors.email && styles.inputInvalid,
                    ]}
                    value={email}
                    onChangeText={(value) => {
                        setEmail(value);
                        clearError('email');
                    }}
                    placeholder="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                />
                {fieldErrors.email ? (
                    <Text style={styles.fieldError}>
                        {fieldErrors.email.join(' ')}
                    </Text>
                ) : null}
            </View>

            <View style={styles.field}>
                <TextInput
                    style={[
                        styles.input,
                        fieldErrors.password && styles.inputInvalid,
                    ]}
                    value={password}
                    onChangeText={(value) => {
                        setPassword(value);
                        clearError('password');
                    }}
                    placeholder="Пароль"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                />
                {fieldErrors.password ? (
                    <Text style={styles.fieldError}>
                        {fieldErrors.password.join(' ')}
                    </Text>
                ) : null}
            </View>

            {formError ? (
                <Text style={styles.formError}>{formError}</Text>
            ) : null}

            <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting }}
                style={[styles.submit, submitting && styles.submitDisabled]}
                disabled={submitting}
                onPress={onSubmit}
            >
                <Text style={styles.submitLabel}>
                    {submitting ? 'Входим…' : 'Войти'}
                </Text>
            </Pressable>

            <Pressable
                accessibilityRole="link"
                style={styles.link}
                onPress={goToRegister}
            >
                <Text style={styles.linkLabel}>
                    Нет аккаунта? Зарегистрируйтесь
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
    title: {
        color: '#000',
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 24,
        textAlign: 'center',
    },
    field: {
        marginBottom: 16,
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
    fieldError: {
        color: '#d32f2f',
        fontSize: 13,
        marginTop: 4,
    },
    formError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    submit: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        marginTop: 8,
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
    link: {
        marginTop: 16,
    },
    linkLabel: {
        color: '#2f6fde',
        fontSize: 15,
        textAlign: 'center',
    },
});
