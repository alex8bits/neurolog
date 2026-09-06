import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { createSeizure } from '@/api/seizures';
import { useAuth } from '@/auth/AuthContext';
import { deviceTimezone } from '@/config/timezone';
import { ApiError, userMessage } from '@/utils/errors';

/** Фаза экрана вместо набора флагов: отправка либо одна из ошибочных веток. */
type QuickPhase = 'sending' | 'retryable' | 'expired';

/**
 * Быстрая запись «Приступ» — маршрут /quick (вторая иконка лаунчера).
 * При живой сессии на mount уходит единственный POST /seizures с одним
 * timezone: время «сейчас» ставит сервер, occurred_at не шлём. После
 * 201 приложение закрывается — журнал не показываем никогда, в том
 * числе по аппаратному back (перехвачен и тоже выходит). Ошибки —
 * короткий текст и одна кнопка: «Повторить» (сеть/5xx/429) либо
 * «Войти снова» (401 после неудачного refresh — молчаливый выход
 * запрещён, MOBILE.md §5). Анонима и до bootstrap не рендерим —
 * редирект на логин делает гард в app/_layout.tsx.
 */
export default function QuickEntryScreen() {
    const { status } = useAuth();
    const router = useRouter();

    const [phase, setPhase] = useState<QuickPhase>('sending');
    const [message, setMessage] = useState('');

    // Автоотправка ровно одна за жизнь экрана: повторные срабатывания
    // эффекта (StrictMode, смена зависимостей) не должны дублировать
    // POST. Кнопка «Повторить» зовёт send напрямую, минуя флаг.
    const autoSentRef = useRef(false);

    /** Одна попытка записи: 201 → выход из приложения; ApiError — по kind. */
    const send = useCallback(async (): Promise<void> => {
        setPhase('sending');

        try {
            await createSeizure({ timezone: deviceTimezone() });

            // Записали — закрываем приложение; журнал, который на тёплом
            // старте может лежать за этим экраном, пользователю не показываем.
            BackHandler.exitApp();
        } catch (error) {
            if (error instanceof ApiError) {
                if (error.kind === 'unauthorized') {
                    // До экрана доходит только после неудачного refresh:
                    // сессии больше нет — предлагаем войти снова.
                    setPhase('expired');
                } else {
                    // Сеть / 5xx / 429 / прочее — повтор имеет смысл.
                    setPhase('retryable');
                }

                setMessage(userMessage(error));

                return;
            }

            // Неожиданная ошибка — не крашимся, показываем общий текст.
            setPhase('retryable');
            setMessage('Сервер недоступен, попробуйте позже.');
        }
    }, []);

    // Единственная авто-попытка — как только сессия подтвердилась.
    useEffect(() => {
        if (status !== 'authed' || autoSentRef.current) {
            return;
        }

        autoSentRef.current = true;
        void send();
    }, [status, send]);

    // Аппаратный back потребляем и выходим из приложения: событие не
    // отдаём навигации — за /quick на тёплом старте может лежать журнал.
    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                BackHandler.exitApp();

                return true;
            },
        );

        return () => {
            subscription.remove();
        };
    }, []);

    if (status !== 'authed') {
        return null;
    }

    return (
        <View style={styles.screen}>
            {phase === 'sending' ? (
                <View style={styles.state}>
                    <ActivityIndicator size="large" color="#2f6fde" />
                    <Text style={styles.hint}>Записываем…</Text>
                </View>
            ) : (
                <View style={styles.state}>
                    <Text style={styles.error}>{message}</Text>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.submit}
                        onPress={() => {
                            if (phase === 'expired') {
                                router.replace('/(auth)/login?returnTo=/quick');
                            } else {
                                void send();
                            }
                        }}
                    >
                        <Text style={styles.submitLabel}>
                            {phase === 'expired' ? 'Войти снова' : 'Повторить'}
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
        paddingHorizontal: 24,
    },
    state: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    hint: {
        color: '#333',
        fontSize: 16,
        marginTop: 12,
        textAlign: 'center',
    },
    error: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    submit: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingHorizontal: 32,
        paddingVertical: 12,
    },
    submitLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
