import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    deleteSeizure,
    emailSeizuresSelf,
    exportSeizuresDocx,
    listSeizures,
} from '@/api/seizures';
import type { ExportPeriodParams, Seizure } from '@/api/types';
import { deviceTimezone } from '@/config/timezone';
import {
    formatDayTitle,
    groupSeizuresByDay,
    pluralizeSeizures,
} from '@/utils/dayGroups';
import { ApiError, userMessage } from '@/utils/errors';
import { isCustomRangeValid, periodToRange } from '@/utils/period';
import type { PeriodFilter } from '@/utils/period';
import { formatHm, formatYmd, parseUtcIso } from '@/utils/time';

const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** MIME DOCX-отчёта — expo-sharing передаёт его системному шарингу. */
const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Сколько показывать итоговый значок «Отправить себе» (галочка/крест). */
const SELF_STATUS_RESET_MS = 5000;

/** Состояние кнопки «Отправить себе»; idle — значка нет. */
type SelfStatus = 'idle' | 'sending' | 'ok' | 'fail';

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

/** Текст ошибки действия над журналом (удаление/экспорт/письмо):
 *  ApiError — по kind, неожиданное — общий. */
function actionErrorText(error: unknown): string {
    return error instanceof ApiError ? userMessage(error) : GENERIC_ERROR_TEXT;
}

/** «14:25» для строки внутри группы дня; непарсируемое (не бывает по
 *  контракту сервера) — сырая строка вместо пустоты. */
function rowTimeLabel(occurredAt: string): string {
    const moment = parseUtcIso(occurredAt);

    return moment !== null ? formatHm(moment) : occurredAt;
}

/**
 * Журнал — список приступов, маршрут «/» (владелец — группа (journal)).
 * Загрузка при фокусе экрана и по pull-to-refresh; порядок строк задаёт
 * сервер (occurred_at DESC, id DESC) — на клиенте не сортируем. Long-press
 * по строке открывает диалог действий (редактирование / удаление с
 * подтверждением) и подсвечивает строку. Гард корневого layout сам уводит
 * на логин при истечении сессии.
 *
 * Фильтр периода: дефолт «Всё время» (from/to не шлются), пресеты
 * «Сегодня / 7 дней / 30 дней» и «Произвольный период». Границы from/to
 * считает periodToRange, сервер трактует их включительно целыми
 * календарными днями в поданной timezone — экран не делает дата-арифметики.
 *
 * Экспорт под фильтром: «Сохранить DOCX» — отчёт скачивается и уходит в
 * системный шаринг (сохранить/отправить), «Отправить себе» — письмо с
 * отчётом на email владельца (фидбек — значок на кнопке: спиннер →
 * галочка/крест, гаснет через 5 с, всплывающих окон нет),
 * «Отправить доктору» — экран-форма письма; период каждого действия —
 * текущий фильтр. Печать отсутствует намеренно: остаётся веб-only,
 * вне скоупа мобильного.
 *
 * Строки сгруппированы по календарным дням (groupSeizuresByDay): заголовок
 * дня с количеством приступов, внутри — только время и комментарий; фон
 * групп чередуется, чтобы дни визуально отделялись. Контент не залезает
 * под статус-бар — paddingTop на insets.top этого экрана.
 */
export default function JournalScreen() {
    const router = useRouter();

    // Отступ статус-бара: контент начинается под часами/уведомлениями.
    const insets = useSafeAreaInsets();

    // null = первая загрузка не завершена: отличаем «грузим» от «пусто».
    const [items, setItems] = useState<Seizure[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [inlineError, setInlineError] = useState<string | null>(null);

    // Блокирует повторный запуск удаления той же строки.
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Блокирует повторный запуск экспорта DOCX (скачивание + шаринг).
    const [docxSaving, setDocxSaving] = useState(false);

    // Кнопка «Отправить себе»: отправка — спиннер на кнопке, результат —
    // галочка/крест, гаснут сами через SELF_STATUS_RESET_MS.
    const [selfStatus, setSelfStatus] = useState<SelfStatus>('idle');

    // Таймер авто-скрытия значка результата; переживать экран и новую
    // отправку он не должен.
    const selfStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Строка, к которой открыт диалог действий (long-press): подсветка
    // фона живёт, пока диалог открыт — гасится каждой кнопкой диалога
    // и закрытием мимо него (onDismiss Android: тап вне / системный back).
    const [activeRowId, setActiveRowId] = useState<number | null>(null);

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

    /** Убирает запись из локального списка тем же фильтром по id. */
    function removeLocalItem(id: number): void {
        setItems((prev) =>
            prev === null ? prev : prev.filter((s) => s.id !== id),
        );
    }

    /** Long-press по строке: подсветка + диалог действий — правка или
     *  удаление (удаление ещё подтверждается отдельным Alert). Подсветку
     *  строки гасит любая кнопка диалога и его закрытие без кнопки
     *  (onDismiss — тап вне диалога / back на Android; на iOS Алерт
     *  без кнопки не закрывается). */
    function openRowActions(seizure: Seizure): void {
        setActiveRowId(seizure.id);

        Alert.alert(
            'Запись',
            rowTimeLabel(seizure.occurred_at),
            [
                {
                    text: 'Отмена',
                    style: 'cancel',
                    onPress: () => {
                        setActiveRowId(null);
                    },
                },
                {
                    text: 'Редактировать',
                    onPress: () => {
                        setActiveRowId(null);
                        router.push({
                            pathname: '/edit',
                            params: {
                                id: String(seizure.id),
                                occurredAt: seizure.occurred_at,
                                comment: seizure.comment ?? '',
                            },
                        });
                    },
                },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: () => {
                        setActiveRowId(null);
                        confirmDelete(seizure);
                    },
                },
            ],
            {
                onDismiss: () => {
                    setActiveRowId(null);
                },
            },
        );
    }

    /** Второй шаг удаления после «Удалить» в диалоге действий строки. */
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
        setPeriodError(null);
        setItems(null);
        setLoadError(null);

        // Панель custom-диапазона сворачиваем только для пресетов: при
        // applyCustomPeriod она остаётся открытой — пользователь настраивает.
        if (next.kind !== 'custom') {
            setCustomOpen(false);
        }

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

    /** Параметры периода для экспорта/писем: те же timezone/from/to, что
     *  уходят в listSeizures — читает periodRef, то есть фильтр актуален
     *  на момент нажатия кнопки. */
    function periodParams(): ExportPeriodParams {
        return {
            timezone: deviceTimezone(),
            ...(periodToRange(periodRef.current) ?? {}),
        };
    }

    /** «Сохранить DOCX»: отчёт за текущий период скачивается в файл и
     *  уходит в системный шаринг (Android: «Сохранить в Файлы»/Диск/
     *  отправить). На Android shareAsync резолвится запуском интента —
     *  закрытие шаринг-шита пользователем не попадает в catch. */
    async function saveDocx(): Promise<void> {
        if (docxSaving) {
            return;
        }

        setDocxSaving(true);

        try {
            const { fileUri } = await exportSeizuresDocx(periodParams());

            await Sharing.shareAsync(fileUri, { mimeType: DOCX_MIME });
        } catch (error) {
            Alert.alert('Экспорт', actionErrorText(error));
        } finally {
            setDocxSaving(false);
        }
    }

    /** «Отправить себе»: письмо с отчётом текущего периода на email
     *  владельца; фидбек — значок на самой кнопке (спиннер → галочка/
     *  крест, гаснет через SELF_STATUS_RESET_MS), без всплывающих окон. */
    async function sendSelf(): Promise<void> {
        if (selfStatus === 'sending') {
            return;
        }

        clearSelfStatusTimer();
        setSelfStatus('sending');

        try {
            await emailSeizuresSelf(periodParams());
            showSelfStatus('ok');
        } catch {
            showSelfStatus('fail');
        }
    }

    /** Показывает итоговый значок и планирует возврат в idle. */
    function showSelfStatus(status: 'ok' | 'fail'): void {
        setSelfStatus(status);

        clearSelfStatusTimer();
        selfStatusTimer.current = setTimeout(() => {
            setSelfStatus('idle');
            selfStatusTimer.current = null;
        }, SELF_STATUS_RESET_MS);
    }

    function clearSelfStatusTimer(): void {
        if (selfStatusTimer.current !== null) {
            clearTimeout(selfStatusTimer.current);
            selfStatusTimer.current = null;
        }
    }

    // Таймер значка не должен пережить экран.
    useEffect(() => clearSelfStatusTimer, []);

    /** «Отправить доктору»: переход на экран-форму письма с периодом
     *  текущего фильтра; роут-параметры — строки: timezone всегда,
     *  from/to — только непустые. */
    function openEmailDoctor(): void {
        const { timezone, from, to } = periodParams();

        router.push({
            pathname: '/(journal)/email-doctor',
            params: {
                timezone,
                ...(from !== undefined ? { from } : {}),
                ...(to !== undefined ? { to } : {}),
            },
        });
    }

    // Шапка: «Настройки» и «+» идут на абсолютные typed routes
    // группы (journal).
    return (
        <View
            style={[
                styles.screen,
                { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
        >
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

            {/* Экспорт-ряд: сетка chips, кнопки — аутлайн-chip без
                выбранного состояния. */}
            <View style={styles.chips}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: docxSaving }}
                    disabled={docxSaving}
                    style={[styles.chip, docxSaving && styles.actionDisabled]}
                    onPress={() => {
                        void saveDocx();
                    }}
                >
                    <Text style={styles.chipLabel}>
                        {docxSaving ? 'Сохраняем…' : 'Сохранить DOCX'}
                    </Text>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                        disabled: selfStatus === 'sending',
                    }}
                    disabled={selfStatus === 'sending'}
                    style={[
                        styles.chip,
                        selfStatus === 'sending' && styles.actionDisabled,
                    ]}
                    onPress={() => {
                        void sendSelf();
                    }}
                >
                    <View style={styles.actionInner}>
                        <Text style={styles.chipLabel}>Отправить себе</Text>
                        {selfStatus === 'sending' ? (
                            <ActivityIndicator
                                size="small"
                                color="#2f6fde"
                            />
                        ) : null}
                        {selfStatus === 'ok' ? (
                            <Text style={styles.statusOk}>✓</Text>
                        ) : null}
                        {selfStatus === 'fail' ? (
                            <Text style={styles.statusFail}>✕</Text>
                        ) : null}
                    </View>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    style={styles.chip}
                    onPress={openEmailDoctor}
                >
                    <Text style={styles.chipLabel}>Отправить доктору</Text>
                </Pressable>
            </View>

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
                    data={dayGroups}
                    keyExtractor={(group) => group.key}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                void load();
                            }}
                        />
                    }
                    renderItem={({ item: group, index }) => (
                        // Фон групп чередуется: чётный индекс — белый,
                        // нечётный — светло-серый; дни визуально
                        // отделяются без рамок.
                        <View
                            style={[
                                styles.group,
                                index % 2 === 0
                                    ? styles.groupEven
                                    : styles.groupOdd,
                            ]}
                        >
                            <Text style={styles.groupTitle}>
                                {formatDayTitle(group.day)} · {group.count}{' '}
                                {pluralizeSeizures(group.count)}
                            </Text>
                            {group.items.map((seizure, rowIndex) => (
                                <Pressable
                                    key={seizure.id}
                                    accessibilityRole="button"
                                    accessibilityHint="Долгое нажатие — действия с записью"
                                    disabled={deletingId === seizure.id}
                                    onLongPress={() => {
                                        openRowActions(seizure);
                                    }}
                                    style={[
                                        styles.row,
                                        rowIndex < group.items.length - 1 &&
                                            styles.rowSeparator,
                                        deletingId === seizure.id &&
                                            styles.rowDisabled,
                                        // Подсветка важнее чередующегося фона
                                        // группы: выбранная строка читается
                                        // поверх полосы дня.
                                        activeRowId === seizure.id &&
                                            styles.rowActive,
                                    ]}
                                >
                                    <Text style={styles.rowTime}>
                                        {rowTimeLabel(seizure.occurred_at)}
                                    </Text>
                                    {seizure.comment !== null ? (
                                        <Text
                                            numberOfLines={3}
                                            style={styles.rowComment}
                                        >
                                            {seizure.comment}
                                        </Text>
                                    ) : null}
                                </Pressable>
                            ))}
                        </View>
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
    actionInner: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    actionDisabled: {
        opacity: 0.6,
    },
    statusOk: {
        color: '#2E7D32',
        fontSize: 14,
        fontWeight: '600',
    },
    statusFail: {
        color: '#d32f2f',
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
        // Хвост списка не прилипает к нижней кромке при докрутке.
        paddingBottom: 24,
    },
    // Горизонтальный отступ здесь, а не в listContent: фон группы тянется
    // от края до края — полосы дней читаются целиком.
    group: {
        paddingHorizontal: 24,
    },
    groupEven: {
        backgroundColor: '#FFFFFF',
    },
    groupOdd: {
        backgroundColor: '#F2F3F5',
    },
    groupTitle: {
        color: '#666',
        fontSize: 13,
        fontWeight: '600',
        paddingBottom: 4,
        paddingTop: 12,
    },
    row: {
        paddingVertical: 6,
    },
    // Разделитель только между строками одной группы: перед заголовком
    // следующего дня линии нет.
    rowSeparator: {
        borderBottomColor: '#eee',
        borderBottomWidth: 1,
    },
    rowDisabled: {
        opacity: 0.6,
    },
    // Лёгкий индиго-акцент строки с открытым диалогом действий — поверх
    // фона группы (белый/серый), гасится любой кнопкой диалога.
    rowActive: {
        backgroundColor: '#E8EAF6',
    },
    rowTime: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    rowComment: {
        color: '#333',
        fontSize: 14,
        marginTop: 3,
    },
});
