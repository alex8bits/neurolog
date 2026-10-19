import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteSeizure, fetchSummary, listSeizures } from '@/api/seizures';
import type { Seizure, SeizureSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ActionSheet } from '@/components/journal/ActionSheet';
import { DaySheet } from '@/components/journal/DaySheet';
import { MonthStrip } from '@/components/journal/MonthStrip';
import { RecordButton } from '@/components/journal/RecordButton';
import { WeekStrip } from '@/components/journal/WeekStrip';
import { PeriodPicker } from '@/components/PeriodPicker';
import { AppText } from '@/components/ui/AppText';
import { deviceTimezone } from '@/config/timezone';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
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

/**
 * Журнал — список приступов, маршрут «/» (вкладка «Журнал» группы (tabs)).
 * Загрузка при фокусе экрана и по pull-to-refresh; порядок строк задаёт
 * сервер (occurred_at DESC, id DESC) — на клиенте не сортируем. Тап по
 * строке открывает шторку действий (правка / комментарий / удаление с
 * подтверждением). Гард корневого layout сам уводит на логин при
 * истечении сессии.
 *
 * Верх экрана: кнопка «Записать приступ» (запись «сейчас»), неделя пн–вс и
 * лента 30 дней — из GET /seizures/summary. Сводка грузится параллельно со
 * списком; её ошибка список не ломает — блоки недели/ленты просто не
 * показываются.
 *
 * Фильтр периода: дефолт «7 дней», пресеты «Сегодня / 7 дней / 30 / Всё» и
 * «Период…». Границы from/to считает periodToRange, сервер трактует их
 * включительно целыми календарными днями в поданной timezone — экран не
 * делает дата-арифметики.
 *
 * Пагинация: сервер отдаёт по 50 свежайших записей (occurred_at DESC) —
 * «Всё» показывает только их, пока не догрузить остальные. При докрутке до
 * конца списка loadMore дозапрашивает следующую страницу (?page=N по мете
 * пагинатора) и дописывает её через appendSeizurePage. Фокус,
 * pull-to-refresh и смена фильтра всегда перезагружают первую страницу.
 *
 * Строки сгруппированы по календарным дням (groupSeizuresByDay) в листы дня.
 * Экспорт и меню переехали во вкладки «Отчёт» / «Профиль».
 */
export default function JournalScreen() {
    const router = useRouter();
    const { user } = useAuth();

    // Отступ статус-бара: контент начинается под часами/уведомлениями.
    const insets = useSafeAreaInsets();

    // null = первая загрузка не завершена: отличаем «грузим» от «пусто».
    const [items, setItems] = useState<Seizure[] | null>(null);
    const [summary, setSummary] = useState<SeizureSummary | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [inlineError, setInlineError] = useState<string | null>(null);

    // Догрузка страниц (infinite scroll): hasMore — есть ли следующая
    // страница по мете пагинатора; loadingMore — идёт дозапрос.
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Блокирует повторный запуск удаления той же строки.
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Запись, для которой открыта шторка действий.
    const [sheetSeizure, setSheetSeizure] = useState<Seizure | null>(null);
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

    // Номер последней успешно загруженной страницы: load() всегда начинает
    // с первой, loadMore запрашивает следующую.
    const lastPageRef = useRef(1);

    // Порядковый номер запроса сводки (общий для load и refreshSummary):
    // устаревший ответ не перезаписывает более свежий.
    const summarySeqRef = useRef(0);

    /**
     * Загрузка первой страницы по текущему фильтру (periodRef): сбрасывает
     * список и пагинацию, всё что догружено — уходит. При неудачном
     * рефетче уже показанный список остаётся. Сводка грузится параллельно
     * и не блокирует список; её ошибка игнорируется.
     */
    const load = useCallback(async (): Promise<void> => {
        const seq = ++requestSeqRef.current;
        const summarySeq = ++summarySeqRef.current;

        setRefreshing(true);

        const range = periodToRange(periodRef.current);

        void fetchSummary({ timezone: deviceTimezone(), ...(range ?? {}) })
            .then((next) => {
                if (
                    seq === requestSeqRef.current &&
                    summarySeq === summarySeqRef.current
                ) {
                    setSummary(next);
                }
            })
            .catch(() => {
                // Без сводки журнал работает: блоки недели/ленты скрыты.
            });

        try {
            const response = await listSeizures({
                timezone: deviceTimezone(),
                page: 1,
                ...(range ?? {}),
            });

            if (seq === requestSeqRef.current) {
                setItems(response.data);
                setLoadError(null);
                lastPageRef.current = response.meta.current_page;
                setHasMore(
                    response.meta.current_page < response.meta.last_page,
                );
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

    /**
     * Догрузка следующей страницы по докрутке списка до конца
     * (FlatList onEndReached): запрос ?page=N, дописывание страниц
     * appendSeizurePage (дубли по id выкидывает). Список на экране не
     * сбрасывается; ошибка догрузки — общий инлайн-текст, повторная
     * попытка — следующая докрутка. Гонку со сменой фильтра гасит
     * сравнение periodRef: страница старого периода, прилетевшая после
     * смены фильтра, к новому списку не дописывается.
     */
    async function loadMore(): Promise<void> {
        if (loadingMore || refreshing || !hasMore || items === null) {
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
            setItems((prev) =>
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
    // (включая системный back) — вариант A дизайн-документа.
    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    // Группы по календарным дням: пересборка только при смене items
    // (загрузка/фильтр/локальное удаление), порядок — как от сервера.
    const dayGroups = useMemo(() => groupSeizuresByDay(items ?? []), [items]);

    const week = useMemo(
        () =>
            summary !== null
                ? weekFromSummary(summary.today, summary.days)
                : null,
        [summary],
    );

    // «Сегодня» для заголовка листа дня: от сервера, иначе — устройство.
    const todayYmd = summary?.today ?? formatYmd(new Date());

    /** Обновляет только сводку (после удаления): список и догруженные
     *  страницы не трогаем. Устаревший ответ при смене фильтра отбрасывается. */
    async function refreshSummary(): Promise<void> {
        const periodAtStart = periodRef.current;
        const seq = ++summarySeqRef.current;

        try {
            const next = await fetchSummary({
                timezone: deviceTimezone(),
                ...(periodToRange(periodAtStart) ?? {}),
            });

            if (
                periodRef.current === periodAtStart &&
                seq === summarySeqRef.current
            ) {
                setSummary(next);
            }
        } catch {
            // Сводка вторична: оставляем прежнюю.
        }
    }

    /** Убирает запись из локального списка тем же фильтром по id. */
    function removeLocalItem(id: number): void {
        setItems((prev) =>
            prev === null ? prev : prev.filter((s) => s.id !== id),
        );
    }

    /** Тап по строке / «···»: открывает шторку действий. */
    function openRowActions(seizure: Seizure): void {
        setSheetSeizure(seizure);
        setSheetVisible(true);
    }

    function closeSheet(): void {
        setSheetVisible(false);
    }

    async function removeSeizure(seizure: Seizure): Promise<void> {
        const { id } = seizure;

        setDeletingId(id);
        setInlineError(null);

        try {
            await deleteSeizure(id);
            removeLocalItem(id);
            void refreshSummary();
        } catch (error) {
            if (error instanceof ApiError && error.kind === 'not_found') {
                // Записи уже нет на сервере — убираем локально.
                removeLocalItem(id);
            } else {
                // Сеть/5xx — инлайн-текст, запись остаётся в списке.
                setInlineError(actionErrorText(error));
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
        setItems(null);
        setLoadError(null);
        setHasMore(false);

        void load();
    }

    const initial = (user?.email ?? '?').charAt(0).toUpperCase();

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

            {summary !== null ? (
                <View style={styles.month}>
                    <MonthStrip days={summary.days} />
                </View>
            ) : null}

            <PeriodPicker value={period} onChange={applyPeriod} />

            {items !== null && loadError !== null ? (
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

            {items === null && loadError === null ? (
                <View style={styles.state}>
                    <AppText color="muted">Загрузка…</AppText>
                </View>
            ) : null}

            {items === null && loadError !== null ? (
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

            {items !== null && items.length === 0 ? (
                <View style={styles.state}>
                    <AppText color="muted" style={styles.emptyText}>
                        {period.kind === 'all'
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
                        isToday={group.key === todayYmd}
                        deletingId={deletingId}
                        onPressRow={openRowActions}
                    />
                )}
            />

            <ActionSheet
                visible={sheetVisible}
                seizure={sheetSeizure}
                onClose={closeSheet}
                onDelete={(seizure) => {
                    void removeSeizure(seizure);
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
