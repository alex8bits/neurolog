import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { updateSeizure } from '@/api/seizures';
import { AppText } from '@/components/ui/AppText';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PickerField } from '@/components/ui/PickerField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { deviceTimezone } from '@/config/timezone';
import { colors, spacing } from '@/theme/tokens';
import { ApiError, userMessage } from '@/utils/errors';
import {
    formatHm,
    formatYmd,
    isBeyondNowPlusMinutes,
    parseUtcIso,
    startOfMinute,
    toNaiveLocalIso,
} from '@/utils/time';

/** Серверный лимит комментария: comment nullable|string|max:2000. */
const COMMENT_MAX_LENGTH = 2000;

/** Зеркало серверного FUTURE_TOLERANCE_MINUTES (SeizureValidationRules.php):
 *  дальше now+5 минут сервер вернёт 422 — блокируем до запроса. */
const FUTURE_TOLERANCE_MINUTES = 5;

/** Роут-параметры от строки журнала; значения теоретически массивы
 *  (повтор имени параметра) — сужаем firstParam-ом. */
type EditScreenParams = {
    id?: string | string[];
    occurredAt?: string | string[];
    comment?: string | string[];
    /** focus=comment — из меню строки: комментарий раскрыт и в фокусе. */
    focus?: string | string[];
};

/** Первое значение роут-параметра; отсутствующий — пустая строка. */
function firstParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }

    return value ?? '';
}

/**
 * Редактирование записи — маршрут /edit группы (journal). Стартовые
 * значения приходят роут-параметрами из строки журнала: id, occurred_at
 * (UTC ISO с Z) и comment. occurred_at уходит всегда — момент редактируется
 * пикерами, поэтому переключатель «Точное время» из new.tsx здесь не нужен:
 * механика (потолок пикера now+5 минут, гард сабмита, подсветка полей по
 * 422) скопирована с new.tsx. После 200 уходим назад — журнал перечитается
 * фокус-эффектом. 404 (запись удалена с другого устройства) — терминальное
 * состояние «Запись не найдена» с кнопкой «Назад»: править нечего, повтор
 * бессмыслен. Сеть/5xx/429 — текст и «Повторить». Отмена — ссылка
 * под кнопкой и системная «назад».
 */
export default function EditSeizureScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<EditScreenParams>();

    // Числовой id из строки; битый (не бывает по контракту перехода)
    // доехав до сервера вернёт 404 → состояние «Запись не найдена».
    const id = Number(firstParam(params.id));

    const [comment, setComment] = useState(() => firstParam(params.comment));

    // Комментарий раскрыт, если непуст или пришёл focus=comment.
    const focusComment = firstParam(params.focus) === 'comment';
    const [commentOpen, setCommentOpen] = useState(
        () => firstParam(params.comment) !== '' || focusComment,
    );
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );

    // Редактируемый момент: предзаполнен occurred_at строки журнала;
    // непарсируемое (не бывает по контракту сервера) — «сейчас», как
    // включение «Точного времени» в new.tsx.
    const [moment, setMoment] = useState(
        () => parseUtcIso(firstParam(params.occurredAt)) ?? startOfMinute(),
    );

    // 404 от PATCH: запись исчезла — форма заменяется терминальным состоянием.
    const [notFound, setNotFound] = useState(false);

    /** Открытый диалог пикера: дата или время; null — закрыт. */
    const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

    /** «Потолок» пикера (now+5 минут), фиксируется при открытии диалога:
     *  Date.now() в рендере запрещён react-hooks/purity. */
    const [pickerMax, setPickerMax] = useState<Date | null>(null);

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

    /** Маппинг ApiError на состояние экрана: 404 — терминальное «не
     *  найдено», validation — подсветка полей, остальное — сообщение
     *  формы с кнопкой «Повторить». */
    function applyError(error: unknown): void {
        if (error instanceof ApiError) {
            if (error.kind === 'not_found') {
                setNotFound(true);

                return;
            }

            if (
                error.kind === 'validation' &&
                error.fieldErrors !== undefined &&
                Object.keys(error.fieldErrors).length > 0
            ) {
                setFieldErrors(error.fieldErrors);

                return;
            }

            setFormError(userMessage(error));

            return;
        }

        // Неожиданная ошибка — не крашимся, показываем общий текст.
        setFormError('Сервер недоступен, попробуйте позже.');
    }

    /** Открытие диалога пикера: первый рубеж «не дальше +5 минут» —
     *  нативный диалог не даст выбрать дату дальше потолка now+5 минут. */
    function openPicker(mode: 'date' | 'time'): void {
        setPickerMax(new Date(Date.now() + FUTURE_TOLERANCE_MINUTES * 60_000));
        setPickerMode(mode);
    }

    // Клиентская проверка одна — «не дальше +5 минут в будущее» для
    // момента; обязательных полей нет, длина комментария ограничена
    // maxLength самого TextInput. occurred_at шлём всегда: момент взят
    // из формы, а не «сейчас» на сервере.
    async function onSubmit(): Promise<void> {
        if (isBeyondNowPlusMinutes(moment, FUTURE_TOLERANCE_MINUTES)) {
            setFieldErrors({
                occurred_at: [
                    'Нельзя записать приступ дальше чем на 5 минут в будущее.',
                ],
            });
            setFormError(null);

            return;
        }

        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        try {
            await updateSeizure(id, {
                timezone: deviceTimezone(),
                comment:
                    !commentOpen || comment.trim() === ''
                        ? undefined
                        : comment.trim(),
                occurred_at: toNaiveLocalIso(moment),
            });

            router.back();
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    if (notFound) {
        return (
            <View style={styles.state}>
                <AppText
                    color="danger"
                    variant="label"
                    style={styles.stateError}
                >
                    Запись не найдена.
                </AppText>
                <PrimaryButton
                    title="Назад"
                    style={styles.back}
                    onPress={() => {
                        router.back();
                    }}
                />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
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

            {pickerMode !== null && pickerMax !== null ? (
                <DateTimePicker
                    value={moment}
                    mode={pickerMode}
                    display="default"
                    is24Hour={true}
                    maximumDate={pickerMax}
                    onChange={(event, date) => {
                        if (event.type === 'set' && date !== undefined) {
                            // Мердж пикеров в один Date: диалог даты меняет
                            // дату, диалог времени — время.
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
                        autoFocus={focusComment}
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
                title={submitting ? 'Сохраняем…' : 'Сохранить'}
                disabled={submitting}
                onPress={onSubmit}
            />

            {formError !== null ? (
                <OutlineButton
                    title="Повторить"
                    style={styles.retry}
                    onPress={() => {
                        void onSubmit();
                    }}
                />
            ) : null}

            <Pressable
                accessibilityRole="button"
                style={styles.cancel}
                onPress={() => {
                    router.back();
                }}
            >
                <AppText color="muted" variant="label">
                    Отмена
                </AppText>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    content: { padding: spacing.xxl },
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
    retry: { marginTop: spacing.md },
    cancel: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        marginTop: spacing.sm,
    },
    state: {
        alignItems: 'center',
        backgroundColor: colors.background,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
    },
    stateError: { marginBottom: spacing.lg, textAlign: 'center' },
    back: { paddingHorizontal: spacing.xxxl },
});
