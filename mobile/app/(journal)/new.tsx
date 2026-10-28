import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { AppText } from '@/components/ui/AppText';
import { PickerField } from '@/components/ui/PickerField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { recordSeizure } from '@/offline/sync';
import { colors, radius, spacing } from '@/theme/tokens';
import {
    ApiError,
    GENERIC_ERROR_TEXT,
    recordRejectedText,
    userMessage,
} from '@/utils/errors';
import {
    formatHm,
    formatYmd,
    isBeyondNowPlusMinutes,
    startOfMinute,
} from '@/utils/time';

/** Серверный лимит комментария: comment nullable|string|max:2000. */
const COMMENT_MAX_LENGTH = 2000;

/** Зеркало серверного FUTURE_TOLERANCE_MINUTES (SeizureValidationRules.php:18):
 *  дальше now+5 минут сервер вернёт 422 — блокируем до запроса. */
const FUTURE_TOLERANCE_MINUTES = 5;

/**
 * Запись приступа — шторка снизу (transparentModal, см. _layout.tsx).
 * Запись идёт через очередь (recordSeizure): occurred_at уходит UTC-строкой
 * с `Z` + timezone устройства + client_id. Сегмент «Сейчас» — момент
 * нажатия кнопки «Записать сейчас». Сегмент «Другое время» — запись задним
 * числом: нативные пикеры даты/времени, уходит выбранный момент. Будущее
 * дальше now+5 минут блокируется клиентом до запроса, серверная 422 с
 * errors.occurred_at — страховка на расхождение часов (запись при этом
 * снимается из очереди, ошибка показывается в форме). Комментарий уходит,
 * только если поле раскрыто («+ комментарий») и заполнено. Сервер принял
 * запись или она сохранена на устройстве (нет связи — уйдёт при досылке) —
 * уходим назад, журнал перерисуется из локального стора. Стор не готов —
 * общая ошибка формы, шторка остаётся открытой.
 *
 * Стартовый сегмент: без параметра — «Сейчас»; с `mode=other` (ссылка
 * «Другое время» под кнопкой записи) сразу «Другое время» с пикерами,
 * предзаполненными текущей минутой.
 */
export default function NewSeizureScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { mode } = useLocalSearchParams<{
        mode?: string | string[];
    }>();

    const startsOther = mode === 'other';

    const [comment, setComment] = useState('');

    /** Раскрыто ли поле комментария. */
    const [commentOpen, setCommentOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    /** Отправка в полёте: два тапа в одном кадре видят ещё старый
     *  submitting, а каждый recordSeizure — новый client_id и новая запись. */
    const inFlight = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );

    /** Включён ли режим «Другое время» (запись задним числом). */
    const [exactTime, setExactTime] = useState(startsOther);

    /** Значение пикеров даты/времени; null, пока «Другое время» выключено. */
    const [moment, setMoment] = useState<Date | null>(() =>
        startsOther ? startOfMinute() : null,
    );

    /** Открытый диалог пикера: дата или время; null — закрыт. */
    const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

    /** «Потолок» пикера (now+5 минут), фиксируется при открытии диалога:
     *  Date.now() в рендере запрещён react-hooks/purity. */
    const [pickerMax, setPickerMax] = useState<Date | null>(null);

    /** Время на подписи под кнопкой: фиксируется при открытии шторки. */
    const [openedAt] = useState(() => formatHm(new Date()));

    /** Ввод после ошибки: чистим сообщение формы и запись поля. */
    function clearError(field: string): void {
        setFormError(null);

        setFieldErrors((prev) => {
            if (!(field in prev)) {
                return prev;
            }

            const next = { ...prev };

            delete next[field];

            return next;
        });
    }

    /** Маппинг ApiError на состояние экрана: validation — подсветка
     *  полей, 422 без ошибок полей — «Сервер не принял запись.», остальное
     *  — сообщение формы. */
    function applyError(error: unknown): void {
        if (error instanceof ApiError) {
            if (
                error.kind === 'validation' &&
                error.fieldErrors !== undefined &&
                Object.keys(error.fieldErrors).length > 0
            ) {
                setFieldErrors(error.fieldErrors);

                return;
            }

            setFormError(
                error.kind === 'validation' || error.kind === 'form'
                    ? recordRejectedText(error)
                    : userMessage(error),
            );

            return;
        }

        // Неожиданная ошибка — не крашимся, показываем общий текст.
        setFormError(GENERIC_ERROR_TEXT);
    }

    /** Переключение «Другого времени»: включение — старт с «сейчас»,
     *  округлённого до минуты; выключение — значение пикеров и ошибку
     *  occurred_at отбрасываем. */
    function toggleExactTime(next: boolean): void {
        setExactTime(next);

        if (next) {
            setMoment(startOfMinute());
        } else {
            setMoment(null);
            clearError('occurred_at');
        }
    }

    /** Открытие диалога пикера: первый рубеж «не дальше +5 минут» —
     *  нативный диалог не даст выбрать дату дальше потолка now+5 минут. */
    function openPicker(mode: 'date' | 'time'): void {
        setPickerMax(new Date(Date.now() + FUTURE_TOLERANCE_MINUTES * 60_000));
        setPickerMode(mode);
    }

    // Клиентская проверка одна — «не дальше +5 минут в будущее» для
    // точного времени; обязательных полей нет, длина комментария
    // ограничена maxLength самого TextInput.
    async function onSubmit(): Promise<void> {
        if (inFlight.current) {
            return;
        }

        if (
            exactTime &&
            moment !== null &&
            isBeyondNowPlusMinutes(moment, FUTURE_TOLERANCE_MINUTES)
        ) {
            setFieldErrors({
                occurred_at: [
                    'Нельзя записать приступ дальше чем на 5 минут в будущее.',
                ],
            });
            setFormError(null);

            return;
        }

        inFlight.current = true;
        let closing = false;

        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        try {
            const result = await recordSeizure({
                occurredAt: exactTime && moment !== null ? moment : new Date(),
                comment:
                    !commentOpen || comment.trim() === ''
                        ? null
                        : comment.trim(),
                owner: user?.email,
            });

            if (result.kind === 'sent' || result.kind === 'queued') {
                // Шторка закрывается: кнопку не разблокируем, флаг не
                // снимаем — до размонтирования второй записи не будет.
                closing = true;
                router.back();

                return;
            }

            if (!mounted.current) {
                return;
            }

            if (result.kind === 'rejected') {
                applyError(result.error);

                return;
            }

            setFormError(GENERIC_ERROR_TEXT);
        } catch (error) {
            if (mounted.current) {
                applyError(error);
            }
        } finally {
            if (!closing) {
                inFlight.current = false;

                if (mounted.current) {
                    setSubmitting(false);
                }
            }
        }
    }

    return (
        <View style={styles.screen}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                style={styles.backdrop}
                onPress={() => {
                    router.back();
                }}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.sheet}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.content}
                    >
                        <AppText variant="title" style={styles.title}>
                            Новая запись
                        </AppText>

                        <SegmentedControl
                            options={[
                                { value: 'now', label: 'Сейчас' },
                                { value: 'other', label: 'Другое время' },
                            ]}
                            value={exactTime ? 'other' : 'now'}
                            onChange={(mode) => {
                                toggleExactTime(mode === 'other');
                            }}
                            style={styles.segments}
                        />

                        {exactTime && moment !== null ? (
                            <View style={styles.field}>
                                <View style={styles.momentRow}>
                                    <PickerField
                                        label="Дата"
                                        value={formatYmd(moment)}
                                        invalid={!!fieldErrors.occurred_at}
                                        onPress={() => {
                                            openPicker('date');
                                        }}
                                    />
                                    <PickerField
                                        label="Время"
                                        value={formatHm(moment)}
                                        invalid={!!fieldErrors.occurred_at}
                                        onPress={() => {
                                            openPicker('time');
                                        }}
                                    />
                                </View>
                                {fieldErrors.occurred_at ? (
                                    <AppText
                                        variant="caption"
                                        color="danger"
                                        style={styles.fieldError}
                                    >
                                        {fieldErrors.occurred_at.join(' ')}
                                    </AppText>
                                ) : null}
                            </View>
                        ) : null}

                        {pickerMode !== null &&
                        moment !== null &&
                        pickerMax !== null ? (
                            <DateTimePicker
                                value={moment}
                                mode={pickerMode}
                                display="default"
                                is24Hour={true}
                                maximumDate={pickerMax}
                                onChange={(event, date) => {
                                    if (
                                        event.type === 'set' &&
                                        date !== undefined
                                    ) {
                                        // Мердж пикеров в один Date: диалог даты
                                        // меняет дату, диалог времени — время.
                                        const next = new Date(moment);

                                        if (pickerMode === 'date') {
                                            next.setFullYear(
                                                date.getFullYear(),
                                                date.getMonth(),
                                                date.getDate(),
                                            );
                                        } else {
                                            next.setHours(
                                                date.getHours(),
                                                date.getMinutes(),
                                                0,
                                                0,
                                            );
                                        }

                                        setMoment(next);
                                        clearError('occurred_at');
                                    }

                                    // 'dismissed' — отменённый диалог, значение не меняем.
                                    setPickerMode(null);
                                }}
                            />
                        ) : null}

                        {commentOpen ? (
                            <View style={styles.field}>
                                <TextField
                                    label="Комментарий"
                                    value={comment}
                                    multiline
                                    error={fieldErrors.comment?.join(' ')}
                                    onChangeText={(value) => {
                                        setComment(value);
                                        clearError('comment');
                                    }}
                                    placeholder="Необязательно"
                                    maxLength={COMMENT_MAX_LENGTH}
                                    containerStyle={styles.fieldReset}
                                />
                                <AppText
                                    variant="caption"
                                    color="muted"
                                    style={styles.counter}
                                >
                                    {comment.length}/{COMMENT_MAX_LENGTH}
                                </AppText>
                            </View>
                        ) : (
                            <Pressable
                                accessibilityRole="button"
                                style={styles.addComment}
                                onPress={() => {
                                    setCommentOpen(true);
                                }}
                            >
                                <AppText color="primary" variant="label">
                                    + комментарий
                                </AppText>
                            </Pressable>
                        )}

                        {formError ? (
                            <AppText
                                color="danger"
                                variant="label"
                                style={styles.formError}
                            >
                                {formError}
                            </AppText>
                        ) : null}

                        <PrimaryButton
                            title={
                                submitting
                                    ? 'Записываем…'
                                    : exactTime
                                      ? 'Записать'
                                      : 'Записать сейчас'
                            }
                            disabled={submitting}
                            onPress={onSubmit}
                            style={styles.submit}
                        />
                        {!exactTime ? (
                            <AppText
                                variant="caption"
                                color="muted"
                                style={styles.submitHint}
                            >
                                {openedAt} · закроется после записи
                            </AppText>
                        ) : null}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: colors.overlay,
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.modal,
        borderTopRightRadius: radius.modal,
        maxHeight: '90%',
        elevation: 16,
        shadowColor: colors.text,
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
    },
    content: {
        paddingHorizontal: spacing.xxl,
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxl,
    },
    title: { marginBottom: spacing.lg },
    segments: { marginBottom: spacing.lg },
    field: { marginBottom: spacing.md },
    fieldReset: { marginBottom: 0 },
    momentRow: { flexDirection: 'row', gap: spacing.md },
    fieldError: { marginTop: spacing.xs },
    counter: { marginTop: spacing.xs, textAlign: 'right' },
    addComment: {
        alignSelf: 'flex-start',
        minHeight: 44,
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    formError: { marginBottom: spacing.md, textAlign: 'center' },
    submit: { minHeight: 56 },
    submitHint: { marginTop: spacing.sm, textAlign: 'center' },
});
