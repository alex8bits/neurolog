import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { listMedicationNames } from '@/api/medicationNames';
import {
    createMedication,
    deleteMedication,
    updateMedication,
} from '@/api/medications';
import type {
    MedicationInput,
    MedicationName,
    MedicationUnit,
} from '@/api/types';
import { MedicationNamePicker } from '@/components/medications/MedicationNamePicker';
import { AppText } from '@/components/ui/AppText';
import { DangerButton } from '@/components/ui/DangerButton';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PickerField } from '@/components/ui/PickerField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing } from '@/theme/tokens';
import { dosageToInput, normalizeDosageInput } from '@/utils/dosage';
import {
    ApiError,
    GENERIC_ERROR_TEXT,
    recordRejectedText,
    userMessage,
} from '@/utils/errors';
import { formatYmd } from '@/utils/time';
import { formatYmdDisplay, parseYmdLocal } from '@/utils/ymd';

/** Серверный лимит нового названия (name max:255). */
const NAME_MAX_LENGTH = 255;

const UNIT_OPTIONS = [
    { value: 'mg', label: 'мг' },
    { value: 'ml', label: 'мл' },
] as const satisfies readonly { value: MedicationUnit; label: string }[];

/** Роут-параметры от карточки списка; значения теоретически массивы
 *  (повтор имени параметра) — сужаем firstParam-ом. Без id — создание. */
type MedicationScreenParams = {
    id?: string | string[];
    name?: string | string[];
    medication_name_id?: string | string[];
    dosage?: string | string[];
    unit?: string | string[];
    start_date?: string | string[];
    end_date?: string | string[];
};

/** Первое значение роут-параметра; отсутствующий — пустая строка. */
function firstParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }

    return value ?? '';
}

/** Поля формы, под которыми выводятся ошибки 422. */
const FORM_FIELDS = new Set([
    'name',
    'medication_name_id',
    'dosage',
    'unit',
    'start_date',
    'end_date',
]);

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Создание и правка лекарства — маршрут /medication группы (journal).
 * Без id — новая запись (начало приёма — сегодня, без окончания); с id —
 * правка, стартовые значения приходят строковыми параметрами из карточки
 * списка. 422 — ошибки под полями, прочее — сообщение формы и «Повторить».
 * После сохранения/удаления — назад: список перечитается фокус-эффектом.
 * 404 при правке — терминальное «Медикамент не найден»; 404 при удалении
 * считается успехом (запись уже удалена).
 */
export default function MedicationScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams<MedicationScreenParams>();

    const rawId = firstParam(params.id);
    const editing = rawId !== '';
    const id = Number(rawId);

    const [name, setName] = useState(() => firstParam(params.name));
    const [medicationNameId, setMedicationNameId] = useState<number | null>(
        () => {
            const initial = Number(firstParam(params.medication_name_id));

            return Number.isInteger(initial) && initial > 0 ? initial : null;
        },
    );
    const [namesPickerOpen, setNamesPickerOpen] = useState(false);
    const [names, setNames] = useState<MedicationName[]>([]);
    const [namesLoaded, setNamesLoaded] = useState(false);
    const [namesLoading, setNamesLoading] = useState(false);
    const [namesError, setNamesError] = useState<string | null>(null);
    const [dosage, setDosage] = useState(() => {
        const initial = firstParam(params.dosage);

        return initial === '' ? '' : dosageToInput(initial);
    });
    const [unit, setUnit] = useState<MedicationUnit>(() =>
        firstParam(params.unit) === 'ml' ? 'ml' : 'mg',
    );
    const [startDate, setStartDate] = useState(() => {
        const initial = firstParam(params.start_date);

        return YMD_RE.test(initial) ? initial : formatYmd(new Date());
    });
    const [endDate, setEndDate] = useState<string | null>(() => {
        const initial = firstParam(params.end_date);

        return YMD_RE.test(initial) ? initial : null;
    });

    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );
    const [notFound, setNotFound] = useState(false);

    /** Открытый диалог даты; null — закрыт. */
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(
        null,
    );
    /** Стартовое значение диалога (фиксируется при открытии). */
    const [pickerValue, setPickerValue] = useState<Date>(() => new Date());

    useLayoutEffect(() => {
        navigation.setOptions({
            title: editing ? 'Медикамент' : 'Новый медикамент',
        });
    }, [navigation, editing]);

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

    function applyError(error: unknown): void {
        if (error instanceof ApiError) {
            // «Не найден» — только про правку существующей записи: 404 на
            // создании значит, что на сервере нет самого маршрута.
            if (error.kind === 'not_found' && editing) {
                setNotFound(true);

                return;
            }

            if (error.kind === 'validation') {
                const fields = error.fieldErrors ?? {};

                // Ошибки показываются только под полями формы: если 422 не
                // про них, текст ошибок уходит в сообщение формы.
                if (Object.keys(fields).some((key) => FORM_FIELDS.has(key))) {
                    setFieldErrors(fields);
                } else {
                    setFormError(recordRejectedText(error));
                }

                return;
            }

            setFormError(userMessage(error));

            return;
        }

        setFormError(GENERIC_ERROR_TEXT);
    }

    async function openNamesPicker(): Promise<void> {
        setNamesPickerOpen(true);

        if (namesLoaded || namesLoading) {
            return;
        }

        setNamesLoading(true);
        setNamesError(null);

        try {
            setNames(await listMedicationNames());
            setNamesLoaded(true);
        } catch (error) {
            setNamesError(
                error instanceof ApiError
                    ? userMessage(error)
                    : GENERIC_ERROR_TEXT,
            );
        } finally {
            setNamesLoading(false);
        }
    }

    function clearNameErrors(): void {
        clearError('name');
        clearError('medication_name_id');
    }

    function openPicker(target: 'start' | 'end'): void {
        const current = target === 'start' ? startDate : endDate;

        setPickerValue(current !== null ? parseYmdLocal(current) : new Date());
        setPickerTarget(target);
    }

    async function onSubmit(): Promise<void> {
        if (submitting || deleting) {
            return;
        }

        const input: MedicationInput = {
            ...(medicationNameId !== null
                ? { medication_name_id: medicationNameId }
                : { name: name.trim() }),
            dosage: normalizeDosageInput(dosage),
            unit,
            start_date: startDate,
            end_date: endDate,
        };

        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        try {
            if (editing) {
                await updateMedication(id, input);
            } else {
                await createMedication(input);
            }

            router.back();
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(): Promise<void> {
        setDeleting(true);
        setFormError(null);

        try {
            await deleteMedication(id);
            router.back();
        } catch (error) {
            if (error instanceof ApiError && error.kind === 'not_found') {
                // Записи уже нет — цель удаления достигнута.
                router.back();

                return;
            }

            setFormError(
                error instanceof ApiError
                    ? userMessage(error)
                    : GENERIC_ERROR_TEXT,
            );
        } finally {
            setDeleting(false);
        }
    }

    function confirmDelete(): void {
        const title =
            name.trim() !== '' ? name.trim() : firstParam(params.name);

        Alert.alert(`Удалить «${title}»?`, 'Действие нельзя отменить.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить',
                style: 'destructive',
                onPress: () => {
                    void remove();
                },
            },
        ]);
    }

    if (notFound) {
        return (
            <View style={styles.state}>
                <AppText
                    color="danger"
                    variant="label"
                    style={styles.stateError}
                >
                    Медикамент не найден.
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

    const busy = submitting || deleting;

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.field}>
                <PickerField
                    label="Название"
                    value={name !== '' ? name : 'Выберите лекарство'}
                    invalid={
                        !!(fieldErrors.medication_name_id || fieldErrors.name)
                    }
                    style={styles.picker}
                    onPress={() => {
                        void openNamesPicker();
                    }}
                />
                {fieldErrors.medication_name_id || fieldErrors.name ? (
                    <AppText
                        variant="caption"
                        color="danger"
                        style={styles.fieldError}
                    >
                        {(
                            fieldErrors.medication_name_id ?? fieldErrors.name
                        ).join(' ')}
                    </AppText>
                ) : null}
            </View>

            <MedicationNamePicker
                visible={namesPickerOpen}
                names={names}
                loading={namesLoading}
                error={namesError}
                selectedId={medicationNameId}
                onSelect={(entry) => {
                    setMedicationNameId(entry.id);
                    setName(entry.name);
                    setNamesPickerOpen(false);
                    clearNameErrors();
                }}
                onAddNew={(text) => {
                    setMedicationNameId(null);
                    setName(text.slice(0, NAME_MAX_LENGTH));
                    setNamesPickerOpen(false);
                    clearNameErrors();
                }}
                onClose={() => {
                    setNamesPickerOpen(false);
                }}
            />

            <TextField
                label="Дозировка"
                value={dosage}
                keyboardType="decimal-pad"
                placeholder="Например, 2,5"
                error={fieldErrors.dosage?.join(' ')}
                onChangeText={(value) => {
                    setDosage(value);
                    clearError('dosage');
                }}
            />

            <View style={styles.field}>
                <SegmentedControl
                    options={UNIT_OPTIONS}
                    value={unit}
                    onChange={(value) => {
                        setUnit(value);
                        clearError('unit');
                    }}
                />
                {fieldErrors.unit ? (
                    <AppText
                        variant="caption"
                        color="danger"
                        style={styles.fieldError}
                    >
                        {fieldErrors.unit.join(' ')}
                    </AppText>
                ) : null}
            </View>

            <View style={styles.field}>
                <PickerField
                    label="Начало приёма"
                    value={formatYmdDisplay(startDate)}
                    invalid={!!fieldErrors.start_date}
                    style={styles.picker}
                    onPress={() => {
                        openPicker('start');
                    }}
                />
                {fieldErrors.start_date ? (
                    <AppText
                        variant="caption"
                        color="danger"
                        style={styles.fieldError}
                    >
                        {fieldErrors.start_date.join(' ')}
                    </AppText>
                ) : null}
            </View>

            <View style={styles.field}>
                <PickerField
                    label="Окончание приёма"
                    value={
                        endDate !== null
                            ? formatYmdDisplay(endDate)
                            : 'Без даты окончания'
                    }
                    invalid={!!fieldErrors.end_date}
                    style={styles.picker}
                    onPress={() => {
                        openPicker('end');
                    }}
                />
                {fieldErrors.end_date ? (
                    <AppText
                        variant="caption"
                        color="danger"
                        style={styles.fieldError}
                    >
                        {fieldErrors.end_date.join(' ')}
                    </AppText>
                ) : null}
                {endDate !== null ? (
                    <Pressable
                        accessibilityRole="button"
                        style={styles.link}
                        onPress={() => {
                            setEndDate(null);
                            clearError('end_date');
                        }}
                    >
                        <AppText color="primary" variant="label">
                            Без даты окончания
                        </AppText>
                    </Pressable>
                ) : null}
            </View>

            {pickerTarget !== null ? (
                <DateTimePicker
                    value={pickerValue}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        if (event.type === 'set' && date !== undefined) {
                            if (pickerTarget === 'start') {
                                setStartDate(formatYmd(date));
                                clearError('start_date');
                            } else {
                                setEndDate(formatYmd(date));
                                clearError('end_date');
                            }
                        }

                        // 'dismissed' — отменённый диалог, значение не меняем.
                        setPickerTarget(null);
                    }}
                />
            ) : null}

            {formError !== null ? (
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
                disabled={busy}
                onPress={() => {
                    void onSubmit();
                }}
            />

            {formError !== null ? (
                <OutlineButton
                    title="Повторить"
                    style={styles.retry}
                    disabled={busy}
                    onPress={() => {
                        void onSubmit();
                    }}
                />
            ) : null}

            {editing ? (
                <DangerButton
                    title="Удалить"
                    style={styles.delete}
                    loading={deleting}
                    disabled={submitting}
                    onPress={confirmDelete}
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
    picker: { flex: 0 },
    fieldError: { marginLeft: spacing.xs, marginTop: spacing.xs },
    link: {
        alignSelf: 'flex-start',
        justifyContent: 'center',
        minHeight: 44,
    },
    formError: { marginBottom: spacing.md, textAlign: 'center' },
    retry: { marginTop: spacing.md },
    delete: { marginTop: spacing.xxl },
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
