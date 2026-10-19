import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing } from '@/theme/tokens';
import { ApiError, userMessage } from '@/utils/errors';

/**
 * Экран регистрации. Клиентских правил сложности пароля нет (политика
 * сервера зависит от окружения) — только совпадение password и
 * подтверждения; остальное покажет серверный 422. timezone пользователь
 * не видит — его подставляет @/api/auth. После успешного register
 * ничего не навигируем — гард в app/_layout.tsx сам уведёт с группы
 * (auth).
 */
export default function RegisterScreen() {
    const { register } = useAuth();
    const router = useRouter();
    // Пришли из быстрой ветки (/quick) — параметр переживёт и логин.
    const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
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
     *  полей (занятый email, слабый пароль против прод-политики),
     *  остальное — сообщение формы. */
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

        if (name.trim() === '') {
            errors.name = ['Введите имя.'];
        }

        if (email.trim() === '') {
            errors.email = ['Введите email.'];
        }

        if (password === '') {
            errors.password = ['Введите пароль.'];
        }

        if (passwordConfirmation === '') {
            errors.password_confirmation = ['Повторите пароль.'];
        } else if (password !== passwordConfirmation) {
            errors.password_confirmation = ['Пароли не совпадают.'];
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
            await register({
                name: name.trim(),
                email: email.trim(),
                password,
            });
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    /** Перекрёстная ссылка на логин: форвардим returnTo, если он есть. */
    function goToLogin(): void {
        if (returnTo !== undefined) {
            router.push({
                pathname: '/(auth)/login',
                params: { returnTo },
            });
        } else {
            router.push('/(auth)/login');
        }
    }

    return (
        <View style={styles.screen}>
            <AppText variant="title" style={styles.title}>
                Регистрация
            </AppText>

            <TextField
                label="Имя"
                value={name}
                onChangeText={(value) => {
                    setName(value);
                    clearError('name');
                }}
                error={fieldErrors.name?.join(' ')}
            />

            <TextField
                label="Email"
                value={email}
                onChangeText={(value) => {
                    setEmail(value);
                    clearError('email');
                }}
                error={fieldErrors.email?.join(' ')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
            />

            <TextField
                label="Пароль"
                value={password}
                onChangeText={(value) => {
                    setPassword(value);
                    clearError('password');
                }}
                error={fieldErrors.password?.join(' ')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
            />

            <TextField
                label="Повторите пароль"
                value={passwordConfirmation}
                onChangeText={(value) => {
                    setPasswordConfirmation(value);
                    clearError('password_confirmation');
                }}
                error={fieldErrors.password_confirmation?.join(' ')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
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
                title={submitting ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
                disabled={submitting}
                onPress={onSubmit}
                style={styles.submit}
            />

            <Pressable
                accessibilityRole="link"
                style={styles.link}
                onPress={goToLogin}
            >
                <AppText
                    variant="label"
                    color="primary"
                    style={styles.linkLabel}
                >
                    Уже есть аккаунт? Войти
                </AppText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.surface,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
    },
    title: {
        marginBottom: spacing.xxl,
        textAlign: 'center',
    },
    formError: {
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    submit: {
        marginTop: spacing.sm,
    },
    link: {
        marginTop: spacing.lg,
    },
    linkLabel: {
        textAlign: 'center',
    },
});
