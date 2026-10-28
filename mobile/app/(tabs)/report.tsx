import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchSummary } from '@/api/seizures';
import type { SeizureSummaryPeriod } from '@/api/types';
import { OfflinePlaceholder } from '@/components/OfflinePlaceholder';
import { PeriodPicker } from '@/components/PeriodPicker';
import { AppText } from '@/components/ui/AppText';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { deviceTimezone } from '@/config/timezone';
import { useJournalExport } from '@/hooks/useJournalExport';
import { useConnectivity } from '@/offline/ConnectivityContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { periodToRange } from '@/utils/period';
import type { PeriodFilter } from '@/utils/period';

/** Значок результата «Отправить себе» на кнопке. */
const SELF_TITLES = {
    idle: 'Отправить себе',
    sending: 'Отправить себе',
    ok: 'Отправить себе ✓',
    fail: 'Отправить себе ✗',
} as const;

/**
 * Вкладка «Отчёт»: период (независимый от журнала, дефолт «7 дней»), итоги
 * периода из GET /seizures/summary и экспорт — доктору, DOCX, себе.
 * Без сети — заглушка (всё здесь серверное); при возврате связи итоги
 * загружаются заново.
 */
export default function ReportScreen() {
    const insets = useSafeAreaInsets();
    const { online } = useConnectivity();

    const [period, setPeriod] = useState<PeriodFilter>({ kind: 'last7' });

    // Экспорт читает период в момент нажатия — держим его и в ref.
    const periodRef = useRef<PeriodFilter>({ kind: 'last7' });

    // null = грузим; summaryFailed — блок «Итоги» тихо скрыт.
    const [totals, setTotals] = useState<SeizureSummaryPeriod | null>(null);
    const [summaryFailed, setSummaryFailed] = useState(false);

    const {
        docxSaving,
        actionError,
        selfStatus,
        saveDocx,
        sendSelf,
        openEmailDoctor,
        clearActionError,
    } = useJournalExport(periodRef);

    function changePeriod(next: PeriodFilter): void {
        periodRef.current = next;
        setPeriod(next);
        clearActionError();
    }

    // Итоги: при фокусе, смене периода и возврате связи; устаревший ответ
    // отбрасывается. Офлайн не запрашиваем — экран показывает заглушку.
    useFocusEffect(
        useCallback(() => {
            if (!online) {
                return;
            }

            let cancelled = false;

            setTotals(null);
            setSummaryFailed(false);

            fetchSummary({
                timezone: deviceTimezone(),
                ...(periodToRange(period) ?? {}),
            })
                .then((next) => {
                    if (!cancelled) {
                        setTotals(next.period);
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setSummaryFailed(true);
                    }
                });

            return () => {
                cancelled = true;
            };
        }, [period, online]),
    );

    if (!online) {
        return <OfflinePlaceholder />;
    }

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[
                styles.content,
                { paddingTop: insets.top + spacing.sm },
            ]}
        >
            <AppText variant="title" style={styles.title}>
                Отчёт
            </AppText>

            <PeriodPicker value={period} onChange={changePeriod} />

            {!summaryFailed ? (
                <View style={styles.block}>
                    <AppText variant="caption" color="muted">
                        ИТОГИ
                    </AppText>
                    <View style={styles.totals}>
                        <View style={styles.total}>
                            <AppText variant="display">
                                {totals !== null ? totals.total : '—'}
                            </AppText>
                            <AppText variant="label" color="muted">
                                Приступов
                            </AppText>
                        </View>
                        <View style={styles.total}>
                            <AppText variant="display">
                                {totals !== null
                                    ? totals.days_with_seizures
                                    : '—'}
                            </AppText>
                            <AppText variant="label" color="muted">
                                Дней с приступами
                            </AppText>
                        </View>
                    </View>
                </View>
            ) : null}

            <View style={styles.block}>
                <AppText variant="caption" color="muted">
                    ОТЧЁТ ЗА ЭТОТ ПЕРИОД
                </AppText>
                <View style={styles.actions}>
                    <PrimaryButton
                        title="Отправить доктору"
                        style={styles.button}
                        onPress={openEmailDoctor}
                    />
                    <OutlineButton
                        title="Сохранить DOCX"
                        style={styles.button}
                        loading={docxSaving}
                        onPress={() => void saveDocx()}
                    />
                    <OutlineButton
                        title={SELF_TITLES[selfStatus]}
                        style={styles.button}
                        loading={selfStatus === 'sending'}
                        onPress={() => void sendSelf()}
                    />
                </View>

                {actionError !== null ? (
                    <AppText
                        variant="label"
                        color="danger"
                        style={styles.error}
                    >
                        {actionError}
                    </AppText>
                ) : null}
                {selfStatus === 'fail' ? (
                    <AppText
                        variant="label"
                        color="danger"
                        style={styles.error}
                    >
                        Не удалось отправить письмо.
                    </AppText>
                ) : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    content: { paddingBottom: spacing.xxxl },
    title: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    block: {
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    totals: { flexDirection: 'row', gap: spacing.md },
    total: {
        backgroundColor: colors.surface,
        borderRadius: radius.sheet,
        flex: 1,
        padding: spacing.lg,
    },
    actions: { gap: spacing.md },
    button: { minHeight: 52 },
    error: { paddingTop: spacing.xs },
});
