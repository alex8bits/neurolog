import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { flush, recordSeizure } from '@/offline/sync';
import { colors } from '@/theme/tokens';
import { GENERIC_ERROR_TEXT, recordRejectedText } from '@/utils/errors';

/** Фаза экрана вместо набора флагов: отправка, ошибка с повтором либо
 *  «сохранено на устройстве» перед выходом. */
type QuickPhase = 'sending' | 'retryable' | 'saved';

/** Сколько висит «Сохранено на устройстве…» перед выходом. */
const SAVED_VISIBLE_MS = 2000;

/** Окно, в котором повторный mount /quick не создаёт вторую запись. */
const REQUEUE_GUARD_MS = 2 * 60_000;

/**
 * Момент, когда /quick последний раз поставил запись в очередь (не
 * отправил). Модульная переменная, а не ref: переживает размонтирование
 * экрана при редиректе на логин (истёкшая сессия) и повторный mount после
 * входа. Сбрасывается при любом выходе из приложения с этого экрана
 * (leave: таймер 'saved' или аппаратный back) — иначе следующий запуск
 * иконки в пределах 2 минут не записал бы новый приступ. Размонтирование
 * гардом при 401 его не трогает.
 */
let queuedAtMs: number | null = null;

/** Запись из /quick уже стоит в очереди недавно — новую не создаём. */
const recentlyQueued = (): boolean =>
    queuedAtMs !== null && Date.now() - queuedAtMs < REQUEUE_GUARD_MS;

/**
 * Быстрая запись «Приступ» — маршрут /quick (вторая иконка лаунчера).
 * При живой сессии на mount уходит единственная запись через очередь
 * (recordSeizure): момент старта попытки — открытия экрана, а для
 * «Повторить» момент нажатия (UTC с `Z`), timezone устройства
 * и client_id. Сервер принял — роутер сбрасывается на журнал и приложение
 * закрывается: пережившее выход состояние уже не указывает на /quick, и
 * тёплый старт вскрывает журнал, а не зависший экран отправки. Нет связи
 * (или 401/5xx/429) — запись остаётся на устройстве: «Сохранено на
 * устройстве — отправим, когда появится связь», через ~2 с тот же выход.
 * Аппаратный back перехвачен и выходит тем же путём (leave).
 *
 * Истёкшая сессия: 401 даёт queued, а onSessionExpired уводит гардом на
 * логин с returnTo=/quick. После входа экран монтируется заново, и чтобы
 * не создать вторую запись, автоотправка пропускается, если запись уже
 * поставлена в очередь не дольше 2 минут назад (queuedAtMs): вместо неё —
 * flush() очереди и сразу ветка 'saved' с выходом.
 *
 * Ошибки — короткий текст и кнопка «Повторить»: 422 (сервер не принял
 * запись, она уже снята из очереди) и «стор не готов» (запись не
 * сохранена). Двойной тап «Повторить» до ре-рендера отсекается ref-флагом
 * в send — вторая запись не создаётся. Анонима и до bootstrap не
 * рендерим — редирект на логин делает гард в app/_layout.tsx.
 */
export default function QuickEntryScreen() {
    const { status, user } = useAuth();
    const ownerEmail = user?.email;
    const router = useRouter();

    // Решение «только досылка» фиксируется при монтировании: повторный
    // mount после входа сразу рисует ветку 'saved'.
    const [resumeQueued] = useState(recentlyQueued);
    const [phase, setPhase] = useState<QuickPhase>(() =>
        resumeQueued ? 'saved' : 'sending',
    );
    const [message, setMessage] = useState('');

    // Автоотправка ровно одна за жизнь экрана: повторные срабатывания
    // эффекта (StrictMode, смена зависимостей) не должны дублировать
    // запись. Кнопка «Повторить» зовёт send напрямую, минуя флаг.
    const autoSentRef = useRef(false);

    // Попытка в полёте: два быстрых тапа «Повторить» в одном кадре
    // видят ещё старую фазу (стейт обновится только на ре-рендере),
    // поэтому отсекаем синхронным ref-флагом, а не проверкой phase.
    // Снимается в finally — после ошибки «Повторить» снова работает.
    const sendInFlightRef = useRef(false);

    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    // Пользователь ушёл back'ом, пока попытка в полёте: её queued уже не
    // должен включать resume-режим следующего запуска.
    const leftRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;

            if (savedTimerRef.current !== null) {
                clearTimeout(savedTimerRef.current);
                savedTimerRef.current = null;
            }
        };
    }, []);

    /** Выход как после успешной записи. replace строго до exitApp:
     *  процесс переживает exitApp, и без сброса роутер остался бы на
     *  /quick с застывшей фазой. Журнал, который на тёплом старте может
     *  лежать за этим экраном, пользователю не показываем. */
    const exit = useCallback((): void => {
        router.replace('/');
        BackHandler.exitApp();
    }, [router]);

    /** Единый выход из приложения с этого экрана (кроме успешной
     *  отправки): гасит таймер 'saved' и сбрасывает queuedAtMs до exitApp,
     *  чтобы следующий запуск иконки записал новый приступ. */
    const leave = useCallback((): void => {
        if (savedTimerRef.current !== null) {
            clearTimeout(savedTimerRef.current);
            savedTimerRef.current = null;
        }

        leftRef.current = true;
        queuedAtMs = null;
        exit();
    }, [exit]);

    /** Выход через ~2 с после «Сохранено на устройстве…». */
    const scheduleExit = useCallback((): void => {
        if (savedTimerRef.current !== null) {
            clearTimeout(savedTimerRef.current);
        }

        savedTimerRef.current = setTimeout(leave, SAVED_VISIBLE_MS);
    }, [leave]);

    /** Одна попытка записи, ветвление по исходу recordSeizure.
     * Повторный вызов, пока попытка в полёте, молча игнорируется. */
    const send = useCallback(async (): Promise<void> => {
        if (sendInFlightRef.current) {
            return;
        }

        // Фазу 'sending' ставит вызывающий: на автоотправке она начальная,
        // «Повторить» переключает её сам (setState в эффекте запрещён).
        sendInFlightRef.current = true;

        try {
            const result = await recordSeizure({
                occurredAt: new Date(),
                comment: null,
                owner: ownerEmail,
            });

            // Ставим до проверки mounted: при 401 гард может размонтировать
            // экран раньше, чем вернётся результат.
            if (result.kind === 'queued' && !leftRef.current) {
                queuedAtMs = Date.now();
            }

            if (!mountedRef.current) {
                return;
            }

            if (result.kind === 'sent') {
                exit();
            } else if (result.kind === 'queued') {
                setPhase('saved');
                scheduleExit();
            } else {
                setPhase('retryable');
                setMessage(
                    result.kind === 'rejected'
                        ? recordRejectedText(result.error)
                        : GENERIC_ERROR_TEXT,
                );
            }
        } catch (error) {
            // Неожиданная ошибка — не крашимся, показываем общий текст.
            console.warn('quick: запись не удалась', error);

            if (mountedRef.current) {
                setPhase('retryable');
                setMessage(GENERIC_ERROR_TEXT);
            }
        } finally {
            // Отпускаем флаг и после ошибки: «Повторить» должен работать.
            sendInFlightRef.current = false;
        }
    }, [exit, scheduleExit, ownerEmail]);

    // Единственная авто-попытка — как только сессия подтвердилась.
    useEffect(() => {
        if (status !== 'authed' || resumeQueued || autoSentRef.current) {
            return;
        }

        autoSentRef.current = true;
        void send();
    }, [status, send, resumeQueued]);

    // Запись уже в очереди (повторный mount после входа): новую не
    // создаём — только досылка и выход через ~2 с. Фаза 'saved' уже
    // начальная. Повторный запуск эффекта перезапускает таймер, а flush
    // single-flight — лишнего POST не будет.
    useEffect(() => {
        if (status !== 'authed' || !resumeQueued) {
            return;
        }

        void flush();
        scheduleExit();
    }, [status, resumeQueued, scheduleExit]);

    // Аппаратный back потребляем и выходим из приложения: событие не
    // отдаём навигации — за /quick на тёплом старте может лежать журнал.
    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                leave();

                return true;
            },
        );

        return () => {
            subscription.remove();
        };
    }, [leave]);

    if (status !== 'authed') {
        return null;
    }

    return (
        <View style={styles.screen}>
            {phase === 'sending' ? (
                <View style={styles.state}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <AppText color="muted" style={styles.hint}>
                        Записываем…
                    </AppText>
                </View>
            ) : phase === 'saved' ? (
                <View style={styles.state}>
                    <AppText color="ok" variant="label" style={styles.saved}>
                        Сохранено на устройстве — отправим, когда появится связь
                    </AppText>
                </View>
            ) : (
                <View style={styles.state}>
                    <AppText
                        color="danger"
                        variant="label"
                        style={styles.error}
                    >
                        {message}
                    </AppText>
                    <PrimaryButton
                        title="Повторить"
                        style={styles.submit}
                        onPress={() => {
                            setPhase('sending');
                            void send();
                        }}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.background,
        flex: 1,
        paddingHorizontal: 24,
    },
    state: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    hint: {
        marginTop: 12,
        textAlign: 'center',
    },
    saved: {
        textAlign: 'center',
    },
    error: {
        marginBottom: 16,
        textAlign: 'center',
    },
    submit: {
        paddingHorizontal: 32,
    },
});
