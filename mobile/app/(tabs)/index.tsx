import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteSeizure, listSeizures, listSeizureWindow } from '@/api/seizures';
import type { Seizure } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ActionSheet } from '@/components/journal/ActionSheet';
import { DaySheet } from '@/components/journal/DaySheet';
import { MonthStrip } from '@/components/journal/MonthStrip';
import { RecordButton } from '@/components/journal/RecordButton';
import { WeekStrip } from '@/components/journal/WeekStrip';
import { PeriodPicker } from '@/components/PeriodPicker';
import { AppText } from '@/components/ui/AppText';
import { deviceTimezone } from '@/config/timezone';
import { useConnectivity } from '@/offline/ConnectivityContext';
import { windowStartYmd } from '@/offline/journalCache';
import {
    getSnapshot,
    removeCachedSeizure,
    removeOutbox,
    setWindowSnapshot,
    useJournalStore,
} from '@/offline/journalStore';
import { buildLocalSummary } from '@/offline/localSummary';
import { filterByRange, mergeEntries } from '@/offline/merge';
import { flush } from '@/offline/sync';
import type { JournalEntry } from '@/offline/types';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import { maybePromptUpdate } from '@/updates/prompt';
import { groupSeizuresByDay } from '@/utils/dayGroups';
import {
    actionErrorText,
    ApiError,
    GENERIC_ERROR_TEXT,
    userMessage,
} from '@/utils/errors';
import { periodToRange } from '@/utils/period';
import type { PeriodFilter } from '@/utils/period';
import { appendSeizurePage } from '@/utils/seizureList';
import { formatYmd } from '@/utils/time';
import { weekFromSummary } from '@/utils/week';

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

const isNetworkError = (error: unknown) =>
    error instanceof ApiError && error.kind === 'network';

/** «Всё» и произвольный период выходят за окно 30 дней: онлайн список
 *  берётся с сервера постранично, остальные периоды — из локального стора. */
const isServerPeriod = (period: PeriodFilter) =>
    period.kind === 'all' || period.kind === 'custom';

/**
 * Журнал — список приступов, маршрут «/» (вкладка «Журнал» группы (tabs)).
 * Тап по строке открывает шторку действий (правка / комментарий / удаление
 * с подтверждением). Гард корневого layout сам уводит на логин при
 * истечении сессии.
 *
 * Источник данных — локальный стор (useJournalStore): снимок серверных
 * записей за 30 дней + очередь неотправленных, склеенные mergeEntries.
 * Неделя и лента 30 дней считаются локально (buildLocalSummary), периоды
 * «Сегодня / 7 / 30 дней» — фильтр того же стора, поэтому журнал работает
 * офлайн. Фокус и pull-to-refresh: сначала досылка очереди (flush), затем
 * онлайн-загрузка окна 30 дней в снимок (setWindowSnapshot) — строго
 * последовательно, чтобы снимок не выкинул запись, принятую сервером
 * после старта запроса окна.
 *
 * «Всё» и «Период…» онлайн — серверный список с пагинацией (per_page=50,
 * loadMore по докрутке через appendSeizurePage), сверху — записи очереди
 * из диапазона. Офлайн эти периоды показывают то, что есть в сторе, с
 * пометкой «Без связи доступны только последние 30 дней».
 *
 * Строки сгруппированы по календарным дням (groupSeizuresByDay) в листы дня;
 * неотправленные записи помечены. Экспорт и меню — во вкладках «Отчёт» /
 * «Профиль».
 */
export default function JournalScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const store = useJournalStore();
    const { online } = useConnectivity();

    // Отступ статус-бара: контент начинается под часами/уведомлениями.
    const insets = useSafeAreaInsets();

    // Серверный список для «Всё»/«Период…» онлайн; null — первая страница
    // ещё не пришла (отличаем «грузим» от «пусто»).
    const [serverItems, setServerItems] = useState<Seizure[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [inlineError, setInlineError] = useState<string | null>(null);

    // «Сейчас» последней загрузки: по нему считаются окно 30 дней,
    // локальная сводка и границы периода — все от одного момента.
    const [now, setNow] = useState(() => new Date());

    // Догрузка страниц (infinite scroll): hasMore — есть ли следующая
    // страница по мете пагинатора; loadingMore — идёт дозапрос.
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Блокирует повторный запуск удаления той же строки.
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Запись, для которой открыта шторка действий.
    const [sheetEntry, setSheetEntry] = useState<JournalEntry | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);

    // Фильтр периода списка; дефолт «7 дней» — как в вебе, весь журнал
    // только явным выбором «Всё».
    const [period, setPeriod] = useState<PeriodFilter>({ kind: 'last7' });

    // Текущий фильтр для load: ref читается в момент вызова, поэтому load
    // имеет стабильную identity (deps []) — смена фильтра не перезапускает
    // useFocusEffect вторым идентичным запросом.
    const periodRef = useRef<PeriodFilter>({ kind: 'last7' });

    // Порядковый номер загрузки: состояние пишет только последний начатый
    // запрос — устаревший ответ при быстром переключении фильтров не
    // перезапишет свежие данные.
    const requestSeqRef = useRef(0);

    // Номер последней успешно загруженной страницы серверного списка.
    const lastPageRef = useRef(1);

    // Экран в фокусе: перезагрузки по событиям стора/связи — только тогда.
    const focusedRef = useRef(false);

    /**
     * Перечитывание журнала: досылка очереди → (онлайн) окно 30 дней в
     * снимок стора, для «Всё»/«Период…» — ещё первая страница серверного
     * списка. Пока стор не загружен, сеть не трогаем: эффект на loaded
     * перезапустит load. Сетевая ошибка красным не показывается — офлайн
     * виден по online, данные остаются из стора.
     */
    const load = useCallback(async (): Promise<void> => {
        const seq = ++requestSeqRef.current;
        const moment = new Date();
        const periodAtStart = periodRef.current;

        setRefreshing(true);
        setNow(moment);

        try {
            await flush();

            if (seq !== requestSeqRef.current) {
                return;
            }

            const snapshot = getSnapshot();

            if (!snapshot.loaded) {
                return;
            }

            const cacheAtStart = snapshot.cache;
            const timezone = deviceTimezone();

            const [windowResult, pageResult] = await Promise.allSettled([
                listSeizureWindow({
                    timezone,
                    from: windowStartYmd(moment),
                    to: formatYmd(moment),
                }),
                isServerPeriod(periodAtStart)
                    ? listSeizures({
                          timezone,
                          page: 1,
                          ...(periodToRange(periodAtStart, moment) ?? {}),
                      })
                    : Promise.resolve(null),
            ]);

            if (seq !== requestSeqRef.current) {
                return;
            }

            let error: unknown = null;

            if (windowResult.status === 'fulfilled') {
                // Кэш менялся во время запроса (досылка из другого триггера,
                // удаление) — снимок мог разминуться с этими правками;
                // оставляем стор как есть, следующая загрузка обновит окно.
                if (getSnapshot().cache === cacheAtStart) {
                    try {
                        await setWindowSnapshot(windowResult.value, moment);
                    } catch {
                        // Стор выгрузили (выход/смена владельца) — писать
                        // снимок некуда, это не ошибка для пользователя.
                    }
                }
            } else if (!isNetworkError(windowResult.reason)) {
                error = windowResult.reason;
            }

            if (pageResult.status === 'fulfilled') {
                const response = pageResult.value;

                if (response !== null) {
                    setServerItems(response.data);
                    lastPageRef.current = response.meta.current_page;
                    setHasMore(
                        response.meta.current_page < response.meta.last_page,
                    );
                }
            } else if (error === null && !isNetworkError(pageResult.reason)) {
                error = pageResult.reason;
            }

            if (seq === requestSeqRef.current) {
                setLoadError(error);
            }
        } finally {
            if (seq === requestSeqRef.current) {
                setRefreshing(false);
            }
        }
    }, []);

    /**
     * Догрузка следующей страницы серверного списка по докрутке до конца
     * (FlatList onEndReached): запрос ?page=N, дописывание страниц
     * appendSeizurePage (дубли по id выкидывает). Только для «Всё» /
     * «Период…» онлайн. Ошибка — общий инлайн-текст, повторная попытка —
     * следующая докрутка. Страница старого периода, прилетевшая после
     * смены фильтра, к новому списку не дописывается.
     */
    async function loadMore(): Promise<void> {
        if (
            !isServerPeriod(period) ||
            !online ||
            loadingMore ||
            refreshing ||
            !hasMore ||
            serverItems === null
        ) {
            return;
        }

        const nextPage = lastPageRef.current + 1;
        const periodAtStart = periodRef.current;

        setLoadingMore(true);

        try {
            const response = await listSeizures({
                timezone: deviceTimezone(),
                page: nextPage,
                ...(periodToRange(periodAtStart) ?? {}),
            });

            if (periodRef.current !== periodAtStart) {
                return;
            }

            lastPageRef.current = response.meta.current_page;
            setHasMore(response.meta.current_page < response.meta.last_page);
            setServerItems((prev) =>
                prev === null ? prev : appendSeizurePage(prev, response.data),
            );
            setInlineError(null);
        } catch (error) {
            setInlineError(actionErrorText(error));
        } finally {
            setLoadingMore(false);
        }
    }

    // Один механизм на монтирование и возвраты из edit/new/settings
    // (включая системный back).
    useFocusEffect(
        useCallback(() => {
            focusedRef.current = true;
            void load();

            return () => {
                focusedRef.current = false;
            };
        }, [load]),
    );

    // Стор загрузился после фокуса (холодный старт: провайдер связи грузит
    // его параллельно) — load, начатый раньше, сеть не трогал.
    const prevLoadedRef = useRef(store.loaded);

    useEffect(() => {
        const wasLoaded = prevLoadedRef.current;
        prevLoadedRef.current = store.loaded;

        if (store.loaded && !wasLoaded && focusedRef.current) {
            void load();
        }
    }, [store.loaded, load]);

    // Связь вернулась — дослать очередь и обновить окно / серверный список.
    const prevOnlineRef = useRef(online);

    useEffect(() => {
        const wasOnline = prevOnlineRef.current;
        prevOnlineRef.current = online;

        if (online && !wasOnline && focusedRef.current) {
            void load();
        }
    }, [online, load]);

    // Проверка обновления — раз за жизнь процесса (флаг внутри модуля),
    // стартовый системный диалог «Скачать / Позже». Fire-and-forget: сбои
    // внутри fail-open, загрузку журнала не блокирует.
    useEffect(() => {
        void maybePromptUpdate();
    }, []);

    // Кэш 30 дней + очередь, без дублей по client_id.
    const entries = useMemo<JournalEntry[]>(
        () =>
            store.cache !== null && store.outbox !== null
                ? mergeEntries(store.cache.seizures, store.outbox.items)
                : [],
        [store.cache, store.outbox],
    );

    const localSummary = useMemo(
        () => buildLocalSummary(entries, now),
        [entries, now],
    );

    const week = useMemo(
        () =>
            store.loaded
                ? weekFromSummary(localSummary.today, localSummary.days)
                : null,
        [store.loaded, localSummary],
    );

    const serverMode = isServerPeriod(period);
    const showServerList = serverMode && online;

    // Строки списка; null — грузим (стор не загружен или первая страница
    // серверного списка ещё не пришла).
    const listEntries = useMemo<JournalEntry[] | null>(() => {
        if (!store.loaded) {
            return null;
        }

        const range = periodToRange(period, now);

        if (!showServerList) {
            return filterByRange(entries, range);
        }

        if (serverItems === null) {
            return null;
        }

        // Записи очереди из диапазона — сверху; уже пришедшие с сервера
        // (тот же client_id) скрываются.
        const serverClientIds = new Set(
            serverItems.flatMap((seizure) =>
                seizure.client_id === null ? [] : [seizure.client_id],
            ),
        );
        const pending = filterByRange(
            entries.filter(
                (entry) =>
                    entry.sync !== 'synced' &&
                    (entry.client_id === null ||
                        !serverClientIds.has(entry.client_id)),
            ),
            range,
        );

        return [
            ...pending,
            ...serverItems.map((seizure): JournalEntry => ({
                ...seizure,
                sync: 'synced',
            })),
        ];
    }, [store.loaded, period, now, showServerList, entries, serverItems]);

    // Группы по календарным дням, порядок — как в listEntries.
    const dayGroups = useMemo(
        () => groupSeizuresByDay(listEntries ?? []),
        [listEntries],
    );

    // Офлайн и окно ни разу не загружалось — показать нечего.
    const noSavedData =
        store.loaded &&
        !online &&
        (store.cache?.synced_at ?? null) === null &&
        entries.length === 0;

    /** Убирает удалённую на сервере запись из серверного списка и снимка. */
    async function dropServerEntry(id: number): Promise<void> {
        setServerItems((prev) =>
            prev === null ? prev : prev.filter((s) => s.id !== id),
        );

        try {
            await removeCachedSeizure(id);
        } catch {
            // Стор выгружен (выход) — чистить нечего.
        }
    }

    /** Тап по строке / «···»: открывает шторку действий. */
    function openRowActions(entry: JournalEntry): void {
        setSheetEntry(entry);
        setSheetVisible(true);
    }

    function closeSheet(): void {
        setSheetVisible(false);
    }

    async function removeEntry(entry: JournalEntry): Promise<void> {
        setInlineError(null);

        // Неотправленная запись живёт только на устройстве — снять из очереди.
        if (entry.sync !== 'synced') {
            if (entry.client_id === null) {
                return;
            }

            try {
                await removeOutbox(entry.client_id);
            } catch {
                setInlineError(GENERIC_ERROR_TEXT);
            }

            return;
        }

        const { id } = entry;

        setDeletingId(id);

        try {
            await deleteSeizure(id);
            await dropServerEntry(id);
        } catch (error) {
            if (error instanceof ApiError && error.kind === 'not_found') {
                // Записи уже нет на сервере — убираем локально.
                await dropServerEntry(id);
            } else {
                // Сеть/5xx — инлайн-текст, запись остаётся в списке.
                setInlineError(actionErrorText(error));
            }
        } finally {
            setDeletingId(null);
        }
    }

    /** Применение фильтра: новый запрос = новое «первое» состояние, строки
     *  и ошибки предыдущего периода не висят рядом. */
    function applyPeriod(next: PeriodFilter): void {
        periodRef.current = next;
        setPeriod(next);
        setServerItems(null);
        setLoadError(null);
        setHasMore(false);

        void load();
    }

    const initial = (user?.email ?? '?').charAt(0).toUpperCase();

    // Серверный список не загрузился ни разу (не сетевая ошибка) —
    // полноэкранная ошибка с «Повторить».
    const fullError =
        store.loaded &&
        showServerList &&
        serverItems === null &&
        loadError !== null;

    const header = (
        <View>
            <View style={styles.header}>
                <AppText variant="title">Журнал</AppText>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Профиль"
                    hitSlop={4}
                    style={styles.avatar}
                    onPress={() => {
                        router.navigate('/profile');
                    }}
                >
                    <AppText color="primary" style={styles.avatarLabel}>
                        {initial}
                    </AppText>
                </Pressable>
            </View>

            <View style={styles.top}>
                <RecordButton onRecorded={() => void load()} />
                {week !== null ? (
                    <View style={styles.weekSheet}>
                        <WeekStrip week={week} />
                    </View>
                ) : null}
            </View>

            {store.loaded ? (
                <View style={styles.month}>
                    <MonthStrip days={localSummary.days} />
                </View>
            ) : null}

            <PeriodPicker value={period} onChange={applyPeriod} />

            {store.loaded && serverMode && !online ? (
                <AppText
                    variant="label"
                    color="muted"
                    style={styles.inlineError}
                >
                    Без связи доступны только последние 30 дней
                </AppText>
            ) : null}

            {listEntries !== null && loadError !== null ? (
                <AppText
                    variant="label"
                    color="danger"
                    style={styles.inlineError}
                >
                    {loadErrorText(loadError)}
                </AppText>
            ) : null}

            {inlineError !== null ? (
                <AppText
                    variant="label"
                    color="danger"
                    style={styles.inlineError}
                >
                    {inlineError}
                </AppText>
            ) : null}

            {listEntries === null && !fullError ? (
                <View style={styles.state}>
                    <AppText color="muted">Загрузка…</AppText>
                </View>
            ) : null}

            {fullError ? (
                <View style={styles.state}>
                    <AppText
                        variant="label"
                        color="danger"
                        style={styles.stateError}
                    >
                        {loadErrorText(loadError)}
                    </AppText>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.retry}
                        onPress={() => {
                            void load();
                        }}
                    >
                        <AppText color="white" style={styles.retryLabel}>
                            Повторить
                        </AppText>
                    </Pressable>
                </View>
            ) : null}

            {noSavedData ? (
                <View style={styles.state}>
                    <AppText color="muted" style={styles.emptyText}>
                        Нет сохранённых данных. Подключитесь к интернету, чтобы
                        загрузить журнал.
                    </AppText>
                </View>
            ) : null}

            {!noSavedData &&
            listEntries !== null &&
            listEntries.length === 0 ? (
                <View style={styles.state}>
                    <AppText color="muted" style={styles.emptyText}>
                        {period.kind === 'all' && online
                            ? 'Приступов пока нет. Нажмите «Записать приступ».'
                            : 'За выбранный период приступов нет.'}
                    </AppText>
                </View>
            ) : null}
        </View>
    );

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <FlatList
                data={dayGroups}
                keyExtractor={(group) => group.key}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={header}
                onEndReached={() => {
                    void loadMore();
                }}
                // Догрузка на пол-экрана до конца: страница успевает
                // загрузиться, докрутка не упирается в спиннер.
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
                            void load();
                        }}
                    />
                }
                renderItem={({ item: group }) => (
                    <DaySheet
                        group={group}
                        isToday={group.key === localSummary.today}
                        deletingId={deletingId}
                        onPressRow={openRowActions}
                    />
                )}
            />

            <ActionSheet
                visible={sheetVisible}
                entry={sheetEntry}
                online={online}
                onClose={closeSheet}
                onDelete={(entry) => {
                    void removeEntry(entry);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.background,
        flex: 1,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
    },
    avatar: {
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderRadius: 18,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    avatarLabel: { fontFamily: fontFamily.extrabold, fontSize: 16 },
    top: { paddingHorizontal: spacing.lg },
    weekSheet: {
        backgroundColor: colors.surface,
        borderRadius: radius.sheet,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
    },
    month: { paddingTop: spacing.md },
    inlineError: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    state: {
        alignItems: 'center',
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.xxxl,
    },
    stateError: { marginBottom: spacing.lg, textAlign: 'center' },
    emptyText: { textAlign: 'center' },
    retry: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: radius.control,
        paddingHorizontal: spacing.xxxl,
        paddingVertical: spacing.md,
    },
    retryLabel: { fontFamily: fontFamily.bold },
    listContent: {
        // Хвост списка не прилипает к нижней кромке при докрутке.
        paddingBottom: spacing.xxl,
    },
    // Спиннер догрузки страницы: заметный отступ, чтобы не дрожал между
    // листами дней.
    footer: {
        paddingVertical: spacing.lg,
    },
});
