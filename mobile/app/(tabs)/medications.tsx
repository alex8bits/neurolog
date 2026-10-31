import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listMedications } from '@/api/medications';
import type {
    Medication,
    MedicationFilters,
    MedicationStatus,
} from '@/api/types';
import { MedicationCard } from '@/components/medications/MedicationCard';
import { OfflinePlaceholder } from '@/components/OfflinePlaceholder';
import { AppText } from '@/components/ui/AppText';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PickerField } from '@/components/ui/PickerField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { useConnectivity } from '@/offline/ConnectivityContext';
import { colors, spacing } from '@/theme/tokens';
import { actionErrorText } from '@/utils/errors';
import { appendPage } from '@/utils/seizureList';
import { formatYmd } from '@/utils/time';
import { formatYmdDisplay, parseYmdLocal } from '@/utils/ymd';

/** Пауза ввода поиска перед запросом. */
const SEARCH_DEBOUNCE_MS = 400;

type StatusFilter = 'all' | MedicationStatus;

/** Короткие подписи — под ширину экрана телефона. */
const STATUS_OPTIONS = [
    { value: 'all', label: 'Все' },
    { value: 'planned', label: 'План' },
    { value: 'active', label: 'Идёт' },
    { value: 'finished', label: 'Окончен' },
] as const satisfies readonly { value: StatusFilter; label: string }[];

/**
 * Вкладка «Медикаменты»: список лекарств пользователя с сервера (статус и
 * сортировка — серверные), фильтры по названию (debounce), статусу и
 * периоду приёма, дозагрузка страниц по докрутке. Только онлайн: без сети —
 * заглушка, офлайн-слой журнала сюда не относится.
 *
 * Страница 1 грузится при фокусе (в том числе по возврату с формы), смене
 * фильтров и pull-to-refresh. Каждый запрос получает номер из requestRef:
 * ответ, начатый до более нового запроса, отбрасывается — и первая
 * страница, и догруженная (страница старых фильтров к новому списку не
 * дописывается).
 */
export default function MedicationsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { online } = useConnectivity();

    // Текст поля поиска и его «устоявшееся» значение для запроса.
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [from, setFrom] = useState<string | null>(null);
    const [to, setTo] = useState<string | null>(null);

    // null — первая страница ещё не пришла (отличаем «грузим» от «пусто»).
    const [items, setItems] = useState<Medication[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Открытый диалог даты периода и его стартовое значение (фиксируется
    // при открытии: new Date() в рендере запрещён react-hooks/purity).
    const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(
        null,
    );
    const [pickerValue, setPickerValue] = useState<Date>(() => new Date());

    // Номер последнего начатого запроса страницы 1.
    const requestRef = useRef(0);

    // Номер последней успешно загруженной страницы.
    const lastPageRef = useRef(1);

    // Фильтры, по которым построен текущий список items (null — списка
    // нет): догрузка идёт по ним, а не по фильтрам из поля ввода.
    const listFiltersRef = useRef<MedicationFilters | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQ(q);
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
        };
    }, [q]);

    // Конец периода раньше начала — запрос не делаем, ошибка локальная.
    const periodInvalid = from !== null && to !== null && to < from;

    // Фильтры запроса; null — период невалиден. Новая identity только при
    // смене значения фильтра — она и перезапускает загрузку.
    const filters = useMemo<MedicationFilters | null>(() => {
        if (periodInvalid) {
            return null;
        }

        return {
            ...(debouncedQ.trim() !== '' ? { q: debouncedQ.trim() } : {}),
            ...(status !== 'all' ? { status } : {}),
            ...(from !== null ? { from } : {}),
            ...(to !== null ? { to } : {}),
        };
    }, [debouncedQ, status, from, to, periodInvalid]);

    const filtersActive =
        debouncedQ.trim() !== '' ||
        status !== 'all' ||
        from !== null ||
        to !== null;

    /** Страница 1 с заменой списка; устаревший ответ отбрасывается. */
    const load = useCallback(
        async (
            current: MedicationFilters,
            viaRefresh = false,
        ): Promise<void> => {
            const seq = ++requestRef.current;

            setLoading(true);
            setRefreshing(viaRefresh);
            // Догрузка предыдущего запроса больше не актуальна.
            setLoadingMore(false);

            try {
                const response = await listMedications(current);

                if (seq !== requestRef.current) {
                    return;
                }

                lastPageRef.current = response.meta.current_page;
                listFiltersRef.current = current;
                setItems(response.data);
                setHasMore(
                    response.meta.current_page < response.meta.last_page,
                );
                setError(null);
            } catch (caught) {
                if (seq === requestRef.current) {
                    setError(actionErrorText(caught));
                    // Догружать нечего: страница 1 не подтверждена.
                    setHasMore(false);

                    // Список построен по другим фильтрам — не показываем
                    // чужие записи, остаются ошибка и «Повторить».
                    if (!sameFilters(listFiltersRef.current, current)) {
                        listFiltersRef.current = null;
                        setItems(null);
                    }
                }
            } finally {
                if (seq === requestRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [],
    );

    // Фокус (включая возврат с формы), смена фильтров, возврат связи.
    useFocusEffect(
        useCallback(() => {
            if (!online || filters === null) {
                return;
            }

            void load(filters);
        }, [online, filters, load]),
    );

    /**
     * Следующая страница по докрутке (onEndReached): запрос ?page=N,
     * склейка без дублей по id. Если за время запроса начат новый запрос
     * страницы 1 (смена фильтров, refresh, фокус), ответ отбрасывается.
     */
    async function loadMore(): Promise<void> {
        const listFilters = listFiltersRef.current;

        if (
            !online ||
            listFilters === null ||
            loading ||
            loadingMore ||
            !hasMore ||
            items === null
        ) {
            return;
        }

        const seq = requestRef.current;
        const nextPage = lastPageRef.current + 1;

        setLoadingMore(true);

        try {
            const response = await listMedications(listFilters, nextPage);

            if (seq !== requestRef.current) {
                return;
            }

            lastPageRef.current = response.meta.current_page;
            setHasMore(response.meta.current_page < response.meta.last_page);
            setItems((prev) =>
                prev === null ? prev : appendPage(prev, response.data),
            );
            setError(null);
        } catch (caught) {
            if (seq === requestRef.current) {
                setError(actionErrorText(caught));
            }
        } finally {
            if (seq === requestRef.current) {
                setLoadingMore(false);
            }
        }
    }

    function openPicker(target: 'from' | 'to'): void {
        const current = target === 'from' ? from : to;

        setPickerValue(current !== null ? parseYmdLocal(current) : new Date());
        setPickerTarget(target);
    }

    function resetPeriod(): void {
        setFrom(null);
        setTo(null);
    }

    function openForm(medication?: Medication): void {
        if (medication === undefined) {
            router.push('/(journal)/medication');

            return;
        }

        router.push({
            pathname: '/(journal)/medication',
            params: {
                id: String(medication.id),
                name: medication.name,
                medication_name_id: String(medication.medication_name_id),
                dosage: medication.dosage,
                unit: medication.unit,
                start_date: medication.start_date,
                end_date: medication.end_date ?? '',
                intake_days: String(medication.intake_days),
                break_days: String(medication.break_days),
            },
        });
    }

    if (!online) {
        return <OfflinePlaceholder />;
    }

    const header = (
        <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
                <AppText variant="title" style={styles.title}>
                    Медикаменты
                </AppText>
                <PrimaryButton
                    title="Добавить"
                    onPress={() => {
                        openForm();
                    }}
                />
            </View>

            <TextField
                label="Поиск по названию"
                value={q}
                onChangeText={setQ}
                placeholder="Например, вигабатрин"
                autoCorrect={false}
                returnKeyType="search"
                containerStyle={styles.reset}
            />

            <SegmentedControl
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
            />

            <View style={styles.period}>
                <AppText variant="caption" color="muted">
                    ПЕРИОД
                </AppText>
                <View style={styles.periodRow}>
                    <PickerField
                        label="от"
                        value={from !== null ? formatYmdDisplay(from) : '—'}
                        invalid={periodInvalid}
                        onPress={() => {
                            openPicker('from');
                        }}
                    />
                    <PickerField
                        label="до"
                        value={to !== null ? formatYmdDisplay(to) : '—'}
                        invalid={periodInvalid}
                        onPress={() => {
                            openPicker('to');
                        }}
                    />
                </View>
                {periodInvalid ? (
                    <AppText variant="caption" color="danger">
                        Дата «до» не может быть раньше даты «от».
                    </AppText>
                ) : null}
                {from !== null || to !== null ? (
                    <OutlineButton title="Сбросить" onPress={resetPeriod} />
                ) : null}
            </View>

            {pickerTarget !== null ? (
                <DateTimePicker
                    value={pickerValue}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        if (event.type === 'set' && date !== undefined) {
                            if (pickerTarget === 'from') {
                                setFrom(formatYmd(date));
                            } else {
                                setTo(formatYmd(date));
                            }
                        }

                        // 'dismissed' — отменённый диалог, значение не меняем.
                        setPickerTarget(null);
                    }}
                />
            ) : null}

            {error !== null && !periodInvalid ? (
                <View style={styles.errorBlock}>
                    <AppText variant="label" color="danger">
                        {error}
                    </AppText>
                    {filters !== null ? (
                        <OutlineButton
                            title="Повторить"
                            onPress={() => {
                                void load(filters);
                            }}
                        />
                    ) : null}
                </View>
            ) : null}

            {!periodInvalid &&
            items !== null &&
            loading &&
            !refreshing &&
            !loadingMore ? (
                <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    accessibilityLabel="Загрузка"
                />
            ) : null}

            {!periodInvalid && items === null && error === null ? (
                <View style={styles.state}>
                    <AppText color="muted">Загрузка…</AppText>
                </View>
            ) : null}

            {!periodInvalid && items !== null && items.length === 0 ? (
                <View style={styles.state}>
                    <AppText color="muted" style={styles.stateText}>
                        {filtersActive
                            ? 'Ничего не найдено'
                            : 'Пока нет медикаментов'}
                    </AppText>
                </View>
            ) : null}
        </View>
    );

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <FlatList
                data={periodInvalid ? [] : (items ?? [])}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={Separator}
                ListHeaderComponent={header}
                keyboardShouldPersistTaps="handled"
                onEndReached={() => {
                    void loadMore();
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loadingMore ? (
                        <View style={styles.footer}>
                            <ActivityIndicator
                                size="small"
                                color={colors.primary}
                            />
                        </View>
                    ) : null
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            if (filters !== null) {
                                void load(filters, true);
                            }
                        }}
                    />
                }
                renderItem={({ item }) => (
                    // Приглушён, пока грузится список по новым фильтрам.
                    <View style={loading && !refreshing && styles.stale}>
                        <MedicationCard medication={item} onPress={openForm} />
                    </View>
                )}
            />
        </View>
    );
}

/** Одинаковые ли фильтры запроса (ключи кладутся в одном порядке). */
function sameFilters(
    a: MedicationFilters | null,
    b: MedicationFilters,
): boolean {
    return a !== null && JSON.stringify(a) === JSON.stringify(b);
}

function Separator() {
    return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    listContent: {
        paddingBottom: spacing.xxl,
        paddingHorizontal: spacing.lg,
    },
    headerBlock: {
        gap: spacing.md,
        paddingBottom: spacing.md,
        paddingTop: spacing.sm,
    },
    titleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
    },
    title: { flex: 1 },
    reset: { marginBottom: 0 },
    period: { gap: spacing.sm },
    periodRow: { flexDirection: 'row', gap: spacing.md },
    errorBlock: { gap: spacing.sm },
    state: {
        alignItems: 'center',
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.xxxl,
    },
    stateText: { textAlign: 'center' },
    separator: { height: spacing.sm },
    stale: { opacity: 0.5 },
    footer: { paddingVertical: spacing.lg },
});
