import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { colors, radius, spacing } from '@/theme/tokens';
import { isCustomRangeValid } from '@/utils/period';
import type { PeriodFilter } from '@/utils/period';
import { formatYmd } from '@/utils/time';
import { parseYmdLocal } from '@/utils/ymd';

type PresetKind = 'today' | 'last7' | 'last30' | 'all';

/** Пресеты фильтра периода; «Период…» — отдельная ссылка рядом.
 *  «Всё» — последним: весь журнал остаётся явным выбором. */
const PERIOD_OPTIONS: { value: PresetKind; label: string }[] = [
    { value: 'today', label: 'Сегодня' },
    { value: 'last7', label: '7 дней' },
    { value: 'last30', label: '30 дн.' },
    { value: 'all', label: 'Всё' },
];

type Props = {
    value: PeriodFilter;
    onChange: (next: PeriodFilter) => void;
};

/**
 * Выбор периода: пресеты + панель произвольных дат (две даты с системным
 * DateTimePicker и кнопка «Применить»). Хранит только UI-состояние панели и
 * черновик дат; сам период владелец держит снаружи (value/onChange).
 */
export function PeriodPicker({ value, onChange }: Props) {
    // Развёрнута ли строка выбора произвольного периода.
    const [customOpen, setCustomOpen] = useState(false);

    // Черновик custom-диапазона; применяется кнопкой «Применить».
    const [draftFrom, setDraftFrom] = useState<Date>(new Date());
    const [draftTo, setDraftTo] = useState<Date>(new Date());

    // Какую дату черновика редактирует открытый пикер.
    const [pickerFor, setPickerFor] = useState<'from' | 'to' | null>(null);

    // Ошибка валидации custom-диапазона (от > до): период не меняем.
    const [periodError, setPeriodError] = useState<string | null>(null);

    function selectPreset(kind: PresetKind): void {
        setPeriodError(null);
        setCustomOpen(false);
        onChange({ kind });
    }

    /** «Применить»: от > до — ошибка, период не меняем. Панель остаётся
     *  открытой — пользователь настраивает диапазон. */
    function applyCustomPeriod(): void {
        const from = formatYmd(draftFrom);
        const to = formatYmd(draftTo);

        if (!isCustomRangeValid(from, to)) {
            setPeriodError('Начало периода больше конца.');

            return;
        }

        setPeriodError(null);
        onChange({ kind: 'custom', from, to });
    }

    return (
        <View>
            <View style={styles.filters}>
                <SegmentedControl
                    options={PERIOD_OPTIONS}
                    value={value.kind === 'custom' ? null : value.kind}
                    onChange={selectPreset}
                />
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                        selected: value.kind === 'custom',
                        expanded: customOpen,
                    }}
                    style={styles.periodLink}
                    onPress={() => {
                        // При открытии панель показывает применённый
                        // диапазон, а не сегодняшнюю дату.
                        if (!customOpen && value.kind === 'custom') {
                            setDraftFrom(parseYmdLocal(value.from));
                            setDraftTo(parseYmdLocal(value.to));
                        }

                        setCustomOpen(!customOpen);
                    }}
                >
                    <AppText
                        variant="label"
                        color={value.kind === 'custom' ? 'text' : 'primary'}
                    >
                        {value.kind === 'custom'
                            ? `Период: ${value.from} — ${value.to}`
                            : 'Период…'}
                    </AppText>
                </Pressable>
            </View>

            {customOpen ? (
                <View>
                    <View style={styles.customRow}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Дата начала"
                            style={styles.customDate}
                            onPress={() => {
                                setPickerFor('from');
                            }}
                        >
                            <AppText variant="label">
                                От: {formatYmd(draftFrom)}
                            </AppText>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Дата конца"
                            style={styles.customDate}
                            onPress={() => {
                                setPickerFor('to');
                            }}
                        >
                            <AppText variant="label">
                                До: {formatYmd(draftTo)}
                            </AppText>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Применить период"
                            style={styles.customApply}
                            onPress={applyCustomPeriod}
                        >
                            <AppText variant="label" color="white">
                                Применить
                            </AppText>
                        </Pressable>
                    </View>
                    {periodError !== null ? (
                        <AppText
                            variant="label"
                            color="danger"
                            style={styles.error}
                        >
                            {periodError}
                        </AppText>
                    ) : null}
                    {pickerFor !== null ? (
                        <DateTimePicker
                            value={pickerFor === 'from' ? draftFrom : draftTo}
                            mode="date"
                            display="default"
                            onChange={(event, date) => {
                                if (
                                    event.type === 'set' &&
                                    date !== undefined
                                ) {
                                    if (pickerFor === 'from') {
                                        setDraftFrom(date);
                                    } else {
                                        setDraftTo(date);
                                    }
                                }

                                setPickerFor(null);
                            }}
                        />
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    filters: {
        gap: spacing.xs,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    periodLink: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        minHeight: 44,
    },
    customRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    customDate: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: radius.control,
        borderWidth: 1,
        flexGrow: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    customApply: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: radius.control,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    error: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
});
