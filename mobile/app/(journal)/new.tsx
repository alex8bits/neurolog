import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import { createSeizure } from '@/api/seizures';
import { deviceTimezone } from '@/config/timezone';
import { ApiError, userMessage } from '@/utils/errors';
import {
    formatYmd,
    isBeyondNowPlusMinutes,
    toNaiveLocalIso,
} from '@/utils/time';

/** Серверный лимит комментария: comment nullable|string|max:2000. */
const COMMENT_MAX_LENGTH = 2000;

/** Зеркало серверного FUTURE_TOLERANCE_MINUTES (SeizureValidationRules.php:18):
 *  дальше now+5 минут сервер вернёт 422 — блокируем до запроса. */
const FUTURE_TOLERANCE_MINUTES = 5;

/** «HH:MM» из локальных компонентов значения пикера — подпись кнопки «Время». */
function formatHm(date: Date): string {
    const pad = (part: number) => String(part).padStart(2, '0');

    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Запись приступа. По умолчанию — «сейчас»: occurred_at не шлём, сервер
 * ставит текущий момент UTC сам, пояс берём устройства. Переключатель
 * «Точное время» — запись задним числом: нативные пикеры даты/времени, в
 * теле POST уходит наивная строка occurred_at (YYYY-MM-DDTHH:mm:ss) +
 * timezone, сервер парсит её в поданном поясе и нормализует в UTC
 * (SeizureMomentNormalizer.php). Будущее дальше now+5 минут блокируется
 * клиентом до запроса, серверная 422 с errors.occurred_at — страховка на
 * расхождение часов. После 201 уходим назад — список перечитается
 * фокус-эффектом экрана журнала.
 */
export default function NewSeizureScreen() {
    const router = useRouter();

    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );

    /** Включён ли режим «Точное время» (запись задним числом). */
    const [exactTime, setExactTime] = useState(false);

    /** Значение пикеров даты/времени; null, пока «Точное время» выключено. */
    const [moment, setMoment] = useState<Date | null>(null);

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

    /** Маппинг ApiError на состояние экрана: validation — подсветка
     *  поля comment, остальное — сообщение формы. */
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

            setFormError(userMessage(error));

            return;
        }

        // Неожиданная ошибка — не крашимся, показываем общий текст.
        setFormError('Сервер недоступен, попробуйте позже.');
    }

    /** Переключение «Точного времени»: включение — старт с «сейчас»,
     *  округлённого до минуты; выключение — значение пикеров и ошибку
     *  occurred_at отбрасываем. */
    function toggleExactTime(next: boolean): void {
        setExactTime(next);

        if (next) {
            setMoment(new Date(Math.floor(Date.now() / 60_000) * 60_000));
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

        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        try {
            await createSeizure({
                timezone: deviceTimezone(),
                comment: comment.trim() === '' ? undefined : comment.trim(),
                ...(exactTime && moment !== null
                    ? { occurred_at: toNaiveLocalIso(moment) }
                    : {}),
            });

            router.back();
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View style={styles.screen}>
            {!exactTime ? (
                <Text style={styles.hint}>Будет записано текущее время</Text>
            ) : null}

            <View style={styles.timeRow}>
                <Text style={styles.timeRowLabel}>Точное время</Text>
                <Switch
                    accessibilityLabel="Точное время"
                    value={exactTime}
                    onValueChange={toggleExactTime}
                />
            </View>

            {exactTime && moment !== null ? (
                <View style={styles.field}>
                    <View style={styles.momentRow}>
                        <Pressable
                            accessibilityRole="button"
                            style={[
                                styles.momentButton,
                                fieldErrors.occurred_at &&
                                    styles.momentButtonInvalid,
                            ]}
                            onPress={() => {
                                openPicker('date');
                            }}
                        >
                            <Text style={styles.momentButtonLabel}>
                                Дата: {formatYmd(moment)}
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            style={[
                                styles.momentButton,
                                fieldErrors.occurred_at &&
                                    styles.momentButtonInvalid,
                            ]}
                            onPress={() => {
                                openPicker('time');
                            }}
                        >
                            <Text style={styles.momentButtonLabel}>
                                Время: {formatHm(moment)}
                            </Text>
                        </Pressable>
                    </View>
                    {fieldErrors.occurred_at ? (
                        <Text style={styles.fieldError}>
                            {fieldErrors.occurred_at.join(' ')}
                        </Text>
                    ) : null}
                </View>
            ) : null}

            {pickerMode !== null && moment !== null ? (
                <DateTimePicker
                    value={moment}
                    mode={pickerMode}
                    display="default"
                    is24Hour={true}
                    maximumDate={pickerMax ?? undefined}
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

            <View style={styles.field}>
                <TextInput
                    style={[
                        styles.input,
                        fieldErrors.comment && styles.inputInvalid,
                    ]}
                    value={comment}
                    multiline
                    onChangeText={(value) => {
                        setComment(value);
                        clearError('comment');
                    }}
                    placeholder="Комментарий (необязательно)"
                    maxLength={COMMENT_MAX_LENGTH}
                />
                {fieldErrors.comment ? (
                    <Text style={styles.fieldError}>
                        {fieldErrors.comment.join(' ')}
                    </Text>
                ) : null}
                <Text style={styles.counter}>
                    {comment.length}/{COMMENT_MAX_LENGTH}
                </Text>
            </View>

            {formError ? (
                <Text style={styles.formError}>{formError}</Text>
            ) : null}

            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    style={styles.cancel}
                    onPress={() => {
                        router.back();
                    }}
                >
                    <Text style={styles.cancelLabel}>Отменить</Text>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitting }}
                    style={[styles.submit, submitting && styles.submitDisabled]}
                    disabled={submitting}
                    onPress={onSubmit}
                >
                    <Text style={styles.submitLabel}>
                        {submitting ? 'Записываем…' : 'Записать'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    hint: {
        color: '#333',
        fontSize: 14,
        marginBottom: 12,
    },
    timeRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    timeRowLabel: {
        color: '#333',
        fontSize: 16,
    },
    momentRow: {
        flexDirection: 'row',
        gap: 12,
    },
    momentButton: {
        alignItems: 'center',
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        paddingVertical: 12,
    },
    momentButtonInvalid: {
        borderColor: '#d32f2f',
    },
    momentButtonLabel: {
        color: '#000',
        fontSize: 16,
    },
    field: {
        marginBottom: 16,
    },
    input: {
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 16,
        minHeight: 96,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    inputInvalid: {
        borderColor: '#d32f2f',
    },
    fieldError: {
        color: '#d32f2f',
        fontSize: 13,
        marginTop: 4,
    },
    counter: {
        color: '#333',
        fontSize: 13,
        marginTop: 4,
        textAlign: 'right',
    },
    formError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancel: {
        alignItems: 'center',
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        paddingVertical: 12,
    },
    cancelLabel: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    submit: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        flex: 1,
        paddingVertical: 12,
    },
    submitDisabled: {
        opacity: 0.6,
    },
    submitLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
