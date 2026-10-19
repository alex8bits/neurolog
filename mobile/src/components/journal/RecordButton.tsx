import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { createSeizure } from '@/api/seizures';
import type { Seizure } from '@/api/types';
import { rowTimeLabel } from '@/components/journal/SeizureRow';
import { AppText } from '@/components/ui/AppText';
import { deviceTimezone } from '@/config/timezone';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import { ApiError, userMessage } from '@/utils/errors';

const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** Сколько висит строка «Записано в …». */
const DONE_VISIBLE_MS = 5000;

type Phase = 'idle' | 'sending' | 'done' | 'error';

type Props = {
    /** Запись создана — экран обновляет журнал и сводку. */
    onRecorded: () => void;
};

/** Главная кнопка «Записать приступ»: запись «сейчас» одним тапом. */
export function RecordButton({ onRecorded }: Props) {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('idle');
    const [created, setCreated] = useState<Seizure | null>(null);
    const [error, setError] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlight = useRef(false);
    const mounted = useRef(true);

    useEffect(
        () => () => {
            mounted.current = false;

            if (timer.current !== null) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    async function record(): Promise<void> {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;

        if (timer.current !== null) {
            clearTimeout(timer.current);
            timer.current = null;
        }

        setPhase('sending');
        setError(null);

        try {
            const seizure = await createSeizure({ timezone: deviceTimezone() });

            if (!mounted.current) {
                return;
            }

            setCreated(seizure);
            setPhase('done');
            timer.current = setTimeout(() => {
                setPhase('idle');
                timer.current = null;
            }, DONE_VISIBLE_MS);
            onRecorded();
        } catch (e) {
            if (!mounted.current) {
                return;
            }

            setError(
                e instanceof ApiError ? userMessage(e) : GENERIC_ERROR_TEXT,
            );
            setPhase('error');
        } finally {
            inFlight.current = false;
        }
    }

    function editTime(seizure: Seizure): void {
        router.push({
            pathname: '/edit',
            params: {
                id: String(seizure.id),
                occurredAt: seizure.occurred_at,
                comment: seizure.comment ?? '',
            },
        });
    }

    return (
        <View>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: phase === 'sending' }}
                disabled={phase === 'sending'}
                onPress={() => {
                    void record();
                }}
                style={({ pressed }) => [
                    styles.button,
                    pressed && styles.pressed,
                ]}
            >
                {phase === 'sending' ? (
                    <ActivityIndicator color={colors.white} />
                ) : (
                    <AppText color="white" style={styles.label}>
                        Записать приступ
                    </AppText>
                )}
            </Pressable>

            {phase === 'done' && created !== null ? (
                <AppText variant="label" color="ok" style={styles.status}>
                    {`Записано в ${rowTimeLabel(created.occurred_at)}`}
                </AppText>
            ) : null}
            {phase === 'done' && created !== null ? (
                <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Изменить время записи"
                    hitSlop={8}
                    style={styles.link}
                    onPress={() => editTime(created)}
                >
                    <AppText variant="label" color="primary">
                        Изменить время
                    </AppText>
                </Pressable>
            ) : null}
            {phase === 'error' && error !== null ? (
                <AppText variant="label" color="danger" style={styles.status}>
                    {error}
                </AppText>
            ) : null}

            <Pressable
                accessibilityRole="link"
                accessibilityLabel="Записать приступ на другое время"
                hitSlop={8}
                style={styles.link}
                onPress={() => router.push('/(journal)/new')}
            >
                <AppText variant="label" color="primary">
                    Другое время
                </AppText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: radius.sheet,
        height: 64,
        justifyContent: 'center',
    },
    pressed: { opacity: 0.85 },
    label: { fontFamily: fontFamily.extrabold, fontSize: 18, lineHeight: 24 },
    status: { paddingTop: spacing.sm, textAlign: 'center' },
    link: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
});
