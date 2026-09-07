import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { deleteSeizure, listSeizures } from '@/api/seizures';
import type { Seizure } from '@/api/types';
import { deviceTimezone } from '@/config/timezone';
import { ApiError, userMessage } from '@/utils/errors';
import { isCustomRangeValid, periodToRange } from '@/utils/period';
import type { PeriodFilter } from '@/utils/period';
import { formatLocalDateTime, formatYmd } from '@/utils/time';

const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** Чипы-пресеты фильтра периода; «Произвольный период» — отдельный чип. */
const PERIOD_PRESETS: { filter: PeriodFilter; label: string }[] = [
    { filter: { kind: 'all' }, label: 'Всё время' },
    { filter: { kind: 'today' }, label: 'Сегодня' },
    { filter: { kind: 'last7' }, label: '7 дней' },
    { filter: { kind: 'last30' }, label: '30 дней' },
];

/** Текст ошибки загрузки: сеть/сессия — из userMessage, прочее — общий. */
function loadErrorText(error: unknown): string {
    if (
        error instanceof ApiError &&
        (error.kind === 'network' || error.kind === 'unauthorized')
    ) {
        return userMessage(error);
    }

    return GENERIC_ERROR_TEXT;
}

/** Текст ошибки удаления: ApiError — по kind, неожиданное — общий. */
function deleteErrorText(error: unknown): string {
    return error instanceof ApiError ? userMessage(error) : GENERIC_ERROR_TEXT;
}

/**
 * Журнал — список приступов, маршрут «/» (владелец — группа (journal)).
 * Загрузка при фокусе экрана и по pull-to-refresh; порядок строк задаёт
 * сервер (occurred_at DESC, id DESC) — на клиенте не сортируем. Удаление —
 * long-press по строке с подтверждением через Alert. Гард корневого
 * layout сам уводит на логин при истечении сессии.
 *
 * Фильтр периода: дефолт «Всё время» (from/to не шлются), пресеты
 * «Сегодня / 7 дней / 30 дней» и «Произвольный период». Границы from/to
 * считает periodToRange, сервер трактует их включительно целыми
 * календарными днями в поданной timezone — экран не делает дата-арифметики.
 */
export default function JournalScreen() {
    const router = useRouter();

    // null = первая загрузка не завершена: отличаем «грузим» от «пусто».
    const [items, setItems] = useState<Seizure[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [inlineError, setInlineError] = useState<string | null>(null);

    // Блокирует повторный запуск удаления той же строки.
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Фильтр периода списка; дефолт «Всё время».
    const [period, setPeriod] = useState<PeriodFilter>({ kind: 'all' });

    // Текущий фильтр для load: ref читается в момент вызова, поэтому load
    // имеет стабильную identity (deps []) — смена фильтра не перезапускает
    // useFocusEffect вторым идентичным запросом.
    const periodRef = useRef<PeriodFilter>({ kind: 'all' });

    // Порядковый номер загрузки: состояние пишет только последний начатый
    // запрос — устаревший ответ при быстром переключении фильтров не
    // перезапишет свежие данные.
    const requestSeqRef = useRef(0);

    // Развёрнута ли строка выбора произвольного периода.
    const [customOpen, setCustomOpen] = useState(false);

    // Черновик custom-диапазона; применяется кнопкой «Применить».
    const [draftFrom, setDraftFrom] = useState<Date>(new Date());
    const [draftTo, setDraftTo] = useState<Date>(new Date());

    // Какую дату черновика редактирует открытый пикер.
    const [pickerFor, setPickerFor] = useState<'from' | 'to' | null>(null);

    // Ошибка валидации custom-диапазона (от > до): запрос не шлём.
    const [periodError, setPeriodError] = useState<string | null>(null);

    /**
     * Загрузка списка по текущему фильтру (periodRef). При неудачном
     * рефетче уже показанный список остаётся.
     */
    const load = useCallback(async (): Promise<void> => {
        const seq = ++requestSeqRef.current;

        setRefreshing(true);

        const range = periodToRange(periodRef.current);

        try {
            const response = await listSeizures({
                timezone: deviceTimezone(),
                ...(range ?? {}),
            });

            if (seq === requestSeqRef.current) {
                setItems(response.data);
                setLoadError(null);
            }
        } catch (error) {
            // items не трогаем; не-ApiError тоже попадает в loadError —
            // рендер покажет для него общий текст.
            if (seq === requestSeqRef.current) {
                setLoadError(error);
            }
        } finally {
            if (seq === requestSeqRef.current) {
                setRefreshing(false);
            }
        }
    }, []);

    // Один механизм на монтирование и возвраты из new/settings
    // (включая системный back) — вариант A дизайн-документа.
    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    /** Убирает запись из локального списка тем же фильтром по id. */
    function removeLocalItem(id: number): void {
        setItems((prev) =>
            prev === null ? prev : prev.filter((s) => s.id !== id),
        );
    }

    /** Подтверждение удаления: long-press по строке списка. */
    function confirmDelete(seizure: Seizure): void {
        Alert.alert('Удалить запись?', 'Действие нельзя отменить.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: () => {
                    void removeSeizure(seizure.id);
                },
            },
        ]);
    }

    async function removeSeizure(id: number): Promise<void> {
        setDeletingId(id);
        setInlineError(null);

        try {
            await deleteSeizure(id);
            removeLocalItem(id);
        } catch (error) {
            if (error instanceof ApiError && error.kind === 'not_found') {
                // Записи уже нет на сервере — убираем локально.
                removeLocalItem(id);
            } else {
                // Сеть/5xx — инлайн-текст, запись остаётся в списке.
                setInlineError(deleteErrorText(error));
            }
        } finally {
            setDeletingId(null);
        }
    }

    /** Применение фильтра: новый запрос = новое «первое» состояние, строки
     *  и ошибки предыдущего периода не висят рядом — до ответа «Загрузка…». */
    function applyPeriod(next: PeriodFilter): void {
        periodRef.current = next;
        setPeriod(next);
        setPeriodError(null);
        setItems(null);
        setLoadError(null);
        void load();
    }

    /** «Применить» в custom-строке: от > до — ошибка, запрос не шлём. */
    function applyCustomPeriod(): void {
        const from = formatYmd(draftFrom);
        const to = formatYmd(draftTo);

        if (!isCustomRangeValid(from, to)) {
            setPeriodError('Начало периода больше конца.');

            return;
        }

        applyPeriod({ kind: 'custom', from, to });
    }

    // Шапка: «Настройки» и «+» идут на абсолютные typed routes
    // группы (journal).
    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Pressable
                    accessibilityRole="link"
                    style={styles.settingsLink}
                    onPress={() => {
                        router.push('/(journal)/settings');
                    }}
                >
                    <Text style={styles.linkLabel}>Настройки</Text>
                </Pressable>
                <Text style={styles.title}>Журнал</Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Новая запись"
                    style={styles.addButton}
                    onPress={() => {
                        router.push('/(journal)/new');
                    }}
                >
                    <Text style={styles.addLabel}>+</Text>
                </Pressable>
            </View>

            <View style={styles.chips}>
                {PERIOD_PRESETS.map((preset) => (
                    <Pressable
                        key={preset.filter.kind}
                        accessibilityRole="button"
                        accessibilityState={{
                            selected: period.kind === preset.filter.kind,
                        }}
                        style={[
                            styles.chip,
                            period.kind === preset.filter.kind &&
                                styles.chipSelected,
                        ]}
                        onPress={() => {
                            applyPeriod(preset.filter);
                        }}
                    >
                        <Text
                            style={[
                                styles.chipLabel,
                                period.kind === preset.filter.kind &&
                                    styles.chipLabelSelected,
                            ]}
                        >
                            {preset.label}
                        </Text>
                    </Pressable>
                ))}
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                        selected: period.kind === 'custom',
                        expanded: customOpen,
                    }}
                    style={[
                        styles.chip,
                        period.kind === 'custom' && styles.chipSelected,
                    ]}
                    onPress={() => {
                        setCustomOpen((open) => !open);
                    }}
                >
                    <Text
                        style={[
                            styles.chipLabel,
                            period.kind === 'custom' &&
                                styles.chipLabelSelected,
                        ]}
                    >
                        Произвольный период
                    </Text>
                </Pressable>
            </View>

            {customOpen ? (
                <View>
                    <View style={styles.customRow}>
                        <Pressable
                            accessibilityRole="button"
                            style={styles.customDate}
                            onPress={() => {
                                setPickerFor('from');
                            }}
                        >
                            <Text style={styles.customDateLabel}>
                                От: {formatYmd(draftFrom)}
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            style={styles.customDate}
                            onPress={() => {
                                setPickerFor('to');
                            }}
                        >
                            <Text style={styles.customDateLabel}>
                                До: {formatYmd(draftTo)}
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            style={styles.customApply}
                            onPress={applyCustomPeriod}
                        >
                            <Text style={styles.customApplyLabel}>
                                Применить
                            </Text>
                        </Pressable>
                    </View>
                    {periodError !== null ? (
                        <Text style={styles.inlineError}>{periodError}</Text>
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

            {items !== null && loadError !== null ? (
                <Text style={styles.inlineError}>
                    {loadErrorText(loadError)}
                </Text>
            ) : null}

            {inlineError !== null ? (
                <Text style={styles.inlineError}>{inlineError}</Text>
            ) : null}

            {items === null && loadError === null ? (
                <View style={styles.state}>
                    <Text style={styles.hint}>Загрузка…</Text>
                </View>
            ) : null}

            {items === null && loadError !== null ? (
                <View style={styles.state}>
                    <Text style={styles.stateError}>
                        {loadErrorText(loadError)}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.retry}
                        onPress={() => {
                            void load();
                        }}
                    >
                        <Text style={styles.retryLabel}>Повторить</Text>
                    </Pressable>
                </View>
            ) : null}

            {items !== null && items.length === 0 ? (
                <View style={styles.state}>
                    <Text style={styles.hint}>
                        {period.kind === 'all'
                            ? 'Приступов пока нет. Нажмите «+», чтобы записать.'
                            : 'За выбранный период приступов нет.'}
                    </Text>
                </View>
            ) : null}

            {items !== null && items.length > 0 ? (
                <FlatList
                    data={items}
                    keyExtractor={(s) => String(s.id)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                void load();
                            }}
                        />
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityHint="Долгое нажатие — удаление записи"
                            disabled={deletingId === item.id}
                            onLongPress={() => {
                                confirmDelete(item);
                            }}
                            style={[
                                styles.row,
                                deletingId === item.id && styles.rowDisabled,
                            ]}
                        >
                            <Text style={styles.rowDate}>
                                {formatLocalDateTime(item.occurred_at)}
                            </Text>
                            {item.comment !== null ? (
                                <Text
                                    numberOfLines={3}
                                    style={styles.rowComment}
                                >
                                    {item.comment}
                                </Text>
                            ) : null}
                        </Pressable>
                    )}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 8,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    settingsLink: {
        paddingVertical: 6,
    },
    linkLabel: {
        color: '#2f6fde',
        fontSize: 15,
    },
    title: {
        color: '#000',
        fontSize: 24,
        fontWeight: '600',
    },
    addButton: {
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    addLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingBottom: 12,
        paddingHorizontal: 24,
        paddingTop: 4,
    },
    chip: {
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    chipSelected: {
        backgroundColor: '#2f6fde',
        borderColor: '#2f6fde',
    },
    chipLabel: {
        color: '#000',
        fontSize: 14,
    },
    chipLabelSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    customRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 24,
    },
    customDate: {
        alignItems: 'center',
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        flexGrow: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    customDateLabel: {
        color: '#000',
        fontSize: 14,
    },
    customApply: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    customApplyLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    inlineError: {
        color: '#d32f2f',
        fontSize: 13,
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    state: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    hint: {
        color: '#333',
        fontSize: 16,
        textAlign: 'center',
    },
    stateError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    retry: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingHorizontal: 32,
        paddingVertical: 12,
    },
    retryLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 24,
    },
    row: {
        borderBottomColor: '#eee',
        borderBottomWidth: 1,
        paddingVertical: 14,
    },
    rowDisabled: {
        opacity: 0.6,
    },
    rowDate: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    rowComment: {
        color: '#333',
        fontSize: 14,
        marginTop: 4,
    },
});
