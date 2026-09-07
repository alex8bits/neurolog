import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { updateSeizure } from '@/api/seizures';
import { deviceTimezone } from '@/config/timezone';
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
 * бессмыслен. Сеть/5xx/429 — текст и «Повторить». Отмена — системная
 * «назад» (стрелка нативного заголовка), отдельной кнопки нет.
 */
export default function EditSeizureScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<EditScreenParams>();

    // Числовой id из строки; битый (не бывает по контракту перехода)
    // доехав до сервера вернёт 404 → состояние «Запись не найдена».
    const id = Number(firstParam(params.id));

    const [comment, setComment] = useState(() => firstParam(params.comment));
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
                comment: comment.trim() === '' ? undefined : comment.trim(),
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
                <Text style={styles.stateError}>Запись не найдена.</Text>
                <Pressable
                    accessibilityRole="button"
                    style={styles.back}
                    onPress={() => {
                        router.back();
                    }}
                >
                    <Text style={styles.backLabel}>Назад</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
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
                    accessibilityState={{ disabled: submitting }}
                    style={[styles.submit, submitting && styles.submitDisabled]}
                    disabled={submitting}
                    onPress={onSubmit}
                >
                    <Text style={styles.submitLabel}>
                        {submitting ? 'Сохраняем…' : 'Сохранить'}
                    </Text>
                </Pressable>
            </View>

            {formError !== null ? (
                <Pressable
                    accessibilityRole="button"
                    style={styles.retry}
                    onPress={() => {
                        void onSubmit();
                    }}
                >
                    <Text style={styles.retryLabel}>Повторить</Text>
                </Pressable>
            ) : null}
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
    retry: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        marginTop: 12,
        paddingHorizontal: 32,
        paddingVertical: 12,
        alignSelf: 'center',
    },
    retryLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    state: {
        alignItems: 'center',
        backgroundColor: '#fff',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    stateError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    back: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingHorizontal: 32,
        paddingVertical: 12,
    },
    backLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
