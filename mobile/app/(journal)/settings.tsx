import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteAccount, fetchProfile, updateProfile } from '@/api/profile';
import type { TimezoneGroup, UserProfile } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ApiError, userMessage } from '@/utils/errors';

/** Серверные лимиты правки профиля (ProfileUpdateRequest): name и
 *  email — string|max:255; maxLength зеркалирует их до запроса. */
const NAME_MAX_LENGTH = 255;
const EMAIL_MAX_LENGTH = 255;

const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** Сбор Т-Банка для добровольных пожертвований — внешняя страница,
 *  открывается в браузере устройства. */
const DONATE_URL = 'https://www.tbank.ru/cf/41k9RdG5ibo';

/** Текст ошибки загрузки: ApiError — по kind (userMessage), неожиданное —
 *  общий текст. */
function loadErrorText(error: unknown): string {
    return error instanceof ApiError ? userMessage(error) : GENERIC_ERROR_TEXT;
}

/** Секция SectionList пикера поясов: регион-заголовок + его зоны. */
type ZoneSection = {
    key: string;
    title: string;
    data: string[];
};

/** Группы поясов → секции пикера, отфильтрованные по подстроке в
 *  названии зоны (без учёта регистра); опустевшие группы отбрасываются. */
function zoneSections(
    timezones: TimezoneGroup[],
    search: string,
): ZoneSection[] {
    const query = search.trim().toLowerCase();

    return timezones
        .map((group) => ({
            key: group.region,
            title: group.region,
            data:
                query === ''
                    ? group.zones
                    : group.zones.filter((zone) =>
                          zone.toLowerCase().includes(query),
                      ),
        }))
        .filter((section) => section.data.length > 0);
}

/**
 * Настройки — маршрут /settings группы (journal). Профиль грузится
 * GET /profile (поля формы + сгруппированный список поясов), правка
 * name/email/timezone — PATCH /profile: 422 мапится в подсветку полей,
 * после успеха изменённый email синхронизируется с SecureStore и
 * состоянием auth (updateEmail). Пояс выбирается в Modal-пикере
 * (поиск + SectionList по регионам) — нативного пикера поясов на
 * Android нет. Внизу — опасная зона: удаление аккаунта (DELETE /profile
 * с подтверждением паролем; успех → только локальный signOutLocally,
 * токены уже отозваны сервером, на логин уводит гвард корня) и выход.
 */
export default function SettingsScreen() {
    const { logout, updateEmail, signOutLocally } = useAuth();

    // Отступ статус-бара внутри Modal-пикера поясов.
    const insets = useSafeAreaInsets();

    // --- Данные GET /profile ---
    // null + нет ошибки = первая загрузка не завершена.
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [timezones, setTimezones] = useState<TimezoneGroup[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Перезапуск загрузки кнопкой «Повторить»: инкремент повторно
    // запускает эффект ниже (mount и retry — один код-путь).
    const [reloadSeq, setReloadSeq] = useState(0);

    // --- Форма профиля (конвенция new.tsx: submitting/formError/fieldErrors) ---
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [timezone, setTimezone] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    // --- Пикер пояса ---
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    // --- Опасная зона удаления ---
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [password, setPassword] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Ошибки удаления живут отдельно от formError/fieldErrors секции
    // профиля: зона удаления внизу экрана, её сообщения и подсветка
    // пароля должны быть видны рядом с кнопкой, а не за вьюпортом, и не
    // стирать подсветку полей профиля (две логически разные формы).
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteFieldErrors, setDeleteFieldErrors] = useState<
        Record<string, string[]>
    >({});

    // --- Выход ---
    const [loggingOut, setLoggingOut] = useState(false);

    // Загрузка профиля: mount и «Повторить» (reloadSeq) — один путь.
    // Отмена — cancelled-флаг как в bootstrap-эффекте AuthContext:
    // ответ зависшего запроса не трогает state размонтированного экрана
    // и перезапущенной загрузки (setState только в then-колбэках —
    // не синхронно в теле эффекта).
    useEffect(() => {
        let cancelled = false;

        fetchProfile().then(
            (response) => {
                if (cancelled) {
                    return;
                }

                setProfile(response.data);
                setTimezones(response.timezones);
                setName(response.data.name);
                setEmail(response.data.email);
                setTimezone(response.data.timezone);
                setLoadError(null);
            },
            (error: unknown) => {
                if (cancelled) {
                    return;
                }

                setLoadError(loadErrorText(error));
            },
        );

        return () => {
            cancelled = true;
        };
    }, [reloadSeq]);

    // Секции пикера: пересборка только при смене списка поясов/поиска.
    const pickerSections = useMemo(
        () => zoneSections(timezones, pickerSearch),
        [timezones, pickerSearch],
    );

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

    /** Маппинг ApiError на состояние экрана: validation — подсветка полей
     *  (name/email/timezone), остальное — сообщение формы. */
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
        setFormError(GENERIC_ERROR_TEXT);
    }

    /** Закрытие пикера: Modal гаснет, поиск сбрасывается — следующий
     *  запуск открывает полный список. */
    function closePicker(): void {
        setPickerVisible(false);
        setPickerSearch('');
    }

    /** Выбор пояса в пикере: значение в форму, ошибки пояса гасим. */
    function selectZone(zone: string): void {
        setTimezone(zone);
        clearError('timezone');
        closePicker();
    }

    /** «Отмена» зоны удаления: сворачиваем и чистим пароль/ошибки. */
    function cancelDelete(): void {
        setConfirmDelete(false);
        setPassword('');
        setDeleteError(null);
        setDeleteFieldErrors({});
    }

    /** Ввод пароля после ошибки удаления: гасим ошибки только этой зоны. */
    function clearDeleteError(field: string): void {
        setDeleteError(null);

        setDeleteFieldErrors((prev) => {
            if (!(field in prev)) {
                return prev;
            }

            const next = { ...prev };

            delete next[field];

            return next;
        });
    }

    /** «Сохранить»: клиентски проверяем непустоту name/email (пояс всегда
     *  выбран из списка сервера), дальше PATCH; изменённый email уходит
     *  в SecureStore/auth, ответ становится текущим профилем. */
    async function onSubmit(): Promise<void> {
        if (profile === null) {
            return;
        }

        const errors: Record<string, string[]> = {};

        if (name.trim() === '') {
            errors.name = ['Введите имя.'];
        }

        if (email.trim() === '') {
            errors.email = ['Введите email.'];
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setFormError(null);

            return;
        }

        setSubmitting(true);
        setFormError(null);
        setFieldErrors({});

        const nextEmail = email.trim();
        const previousEmail = profile.email;

        try {
            const updated = await updateProfile({
                name: name.trim(),
                email: nextEmail,
                timezone,
            });

            // Смена email синхронизирует SecureStore и состояние auth —
            // bootstrap после рестарта видит новый адрес. Синхронизация
            // ДО setProfile: при её ошибке повторный «Сохранить» снова
            // увидит прежний email в profile и ретраит запись.
            if (nextEmail !== previousEmail) {
                await updateEmail(nextEmail);
            }

            setProfile(updated);

            Alert.alert('', 'Профиль обновлён');
        } catch (error) {
            applyError(error);
        } finally {
            setSubmitting(false);
        }
    }

    /** «Удалить навсегда»: сервер проверяет пароль, отзывает токены и
     *  удаляет записи каскадами — после 204 достаточно локального
     *  выхода (на логин уводит гвард). Сетевая ошибка оставляет сессию
     *  и данные нетронутыми — удаление не best-effort. Ошибки идут в
     *  состояние зоны удаления (deleteError/подсветка пароля), поля
     *  профиля не задействованы. */
    async function onDelete(): Promise<void> {
        setDeleting(true);
        setDeleteError(null);
        setDeleteFieldErrors({});

        try {
            await deleteAccount(password);
            await signOutLocally();
        } catch (error) {
            if (
                error instanceof ApiError &&
                error.kind === 'validation' &&
                error.fieldErrors !== undefined &&
                Object.keys(error.fieldErrors).length > 0
            ) {
                setDeleteFieldErrors(error.fieldErrors);
            } else {
                setDeleteError(
                    error instanceof ApiError
                        ? userMessage(error)
                        : GENERIC_ERROR_TEXT,
                );
            }
        } finally {
            setDeleting(false);
        }
    }

    /** «Поддержать проект»: открывает страницу сбора в браузере;
     *  при недоступности (нет браузера/ссылки) — короткий Alert. */
    async function onDonate(): Promise<void> {
        try {
            await Linking.openURL(DONATE_URL);
        } catch {
            Alert.alert('', 'Не удалось открыть страницу сбора.');
        }
    }

    /** Выход (логика прежнего экрана настроек): гвард сам уведёт на
     *  /(auth)/login после смены статуса. */
    async function onLogout(): Promise<void> {
        setLoggingOut(true);

        try {
            await logout();
        } finally {
            setLoggingOut(false);
        }
    }

    return (
        <View style={styles.screen}>
            {profile === null && loadError === null ? (
                <View style={styles.state}>
                    <Text style={styles.stateHint}>Загрузка…</Text>
                </View>
            ) : null}

            {profile === null && loadError !== null ? (
                <View style={styles.state}>
                    <Text style={styles.stateError}>{loadError}</Text>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.retry}
                        onPress={() => {
                            setReloadSeq((seq) => seq + 1);
                        }}
                    >
                        <Text style={styles.retryLabel}>Повторить</Text>
                    </Pressable>
                </View>
            ) : null}

            {profile !== null ? (
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Профиль</Text>

                        <View style={styles.field}>
                            <Text style={styles.label}>Имя</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    fieldErrors.name && styles.inputInvalid,
                                ]}
                                value={name}
                                onChangeText={(value) => {
                                    setName(value);
                                    clearError('name');
                                }}
                                accessibilityLabel="Имя"
                                maxLength={NAME_MAX_LENGTH}
                            />
                            {fieldErrors.name ? (
                                <Text style={styles.fieldError}>
                                    {fieldErrors.name.join(' ')}
                                </Text>
                            ) : null}
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    fieldErrors.email && styles.inputInvalid,
                                ]}
                                value={email}
                                onChangeText={(value) => {
                                    setEmail(value);
                                    clearError('email');
                                }}
                                accessibilityLabel="Email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={EMAIL_MAX_LENGTH}
                            />
                            {fieldErrors.email ? (
                                <Text style={styles.fieldError}>
                                    {fieldErrors.email.join(' ')}
                                </Text>
                            ) : null}
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Часовой пояс</Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Часовой пояс: ${timezone}`}
                                style={[
                                    styles.zoneButton,
                                    fieldErrors.timezone &&
                                        styles.inputInvalid,
                                ]}
                                onPress={() => {
                                    setPickerVisible(true);
                                }}
                            >
                                <Text style={styles.zoneButtonLabel}>
                                    {timezone}
                                </Text>
                            </Pressable>
                            <Text style={styles.fieldHint}>
                                Время приступов отображается и экспортируется
                                в этом поясе.
                            </Text>
                            {fieldErrors.timezone ? (
                                <Text style={styles.fieldError}>
                                    {fieldErrors.timezone.join(' ')}
                                </Text>
                            ) : null}
                        </View>

                        {formError ? (
                            <Text style={styles.formError}>{formError}</Text>
                        ) : null}

                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: submitting }}
                            style={[
                                styles.submit,
                                submitting && styles.actionDisabled,
                            ]}
                            disabled={submitting}
                            onPress={onSubmit}
                        >
                            <Text style={styles.submitLabel}>
                                {submitting ? 'Сохраняем…' : 'Сохранить'}
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Удаление аккаунта
                        </Text>
                        <Text style={styles.dangerWarning}>
                            Удаление аккаунта необратимо: будут удалены все
                            записи журнала.
                        </Text>

                        {confirmDelete ? (
                            <View>
                                <TextInput
                                    style={[
                                        styles.input,
                                        deleteFieldErrors.password &&
                                            styles.inputInvalid,
                                    ]}
                                    value={password}
                                    onChangeText={(value) => {
                                        setPassword(value);
                                        clearDeleteError('password');
                                    }}
                                    placeholder="Пароль"
                                    accessibilityLabel="Пароль"
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {deleteFieldErrors.password ? (
                                    <Text style={styles.fieldError}>
                                        {deleteFieldErrors.password.join(' ')}
                                    </Text>
                                ) : null}
                                {deleteError ? (
                                    <Text style={styles.fieldError}>
                                        {deleteError}
                                    </Text>
                                ) : null}
                                <View style={styles.dangerActions}>
                                    <Pressable
                                        accessibilityRole="button"
                                        style={styles.cancel}
                                        onPress={cancelDelete}
                                    >
                                        <Text style={styles.cancelLabel}>
                                            Отмена
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            disabled: deleting,
                                        }}
                                        style={[
                                            styles.dangerSubmit,
                                            deleting && styles.actionDisabled,
                                        ]}
                                        disabled={deleting}
                                        onPress={onDelete}
                                    >
                                        <Text style={styles.dangerSubmitLabel}>
                                            {deleting
                                                ? 'Удаляем…'
                                                : 'Удалить навсегда'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <Pressable
                                accessibilityRole="button"
                                style={styles.dangerButton}
                                onPress={() => {
                                    setConfirmDelete(true);
                                }}
                            >
                                <Text style={styles.dangerButtonLabel}>
                                    Удалить аккаунт
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        style={styles.donate}
                        onPress={onDonate}
                    >
                        <Text style={styles.donateLabel}>
                            Поддержать проект
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: loggingOut }}
                        style={[styles.logout, loggingOut && styles.actionDisabled]}
                        disabled={loggingOut}
                        onPress={onLogout}
                    >
                        <Text style={styles.logoutLabel}>
                            {loggingOut ? 'Выходим…' : 'Выйти'}
                        </Text>
                    </Pressable>
                </ScrollView>
            ) : null}

            <Modal
                visible={pickerVisible}
                animationType="slide"
                onRequestClose={closePicker}
            >
                <View
                    style={[styles.pickerScreen, { paddingTop: insets.top }]}
                >
                    <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>Часовой пояс</Text>
                        <Pressable
                            accessibilityRole="button"
                            style={styles.pickerCancel}
                            onPress={closePicker}
                        >
                            <Text style={styles.pickerCancelLabel}>Отмена</Text>
                        </Pressable>
                    </View>
                    <TextInput
                        style={styles.pickerSearch}
                        value={pickerSearch}
                        onChangeText={setPickerSearch}
                        placeholder="Поиск"
                        accessibilityLabel="Поиск часового пояса"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <SectionList
                        style={styles.pickerList}
                        sections={pickerSections}
                        keyExtractor={(zone) => zone}
                        keyboardShouldPersistTaps="handled"
                        renderSectionHeader={({ section }) => (
                            <Text style={styles.pickerRegion}>
                                {section.title}
                            </Text>
                        )}
                        renderItem={({ item }) => (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{
                                    selected: item === timezone,
                                }}
                                style={styles.pickerZone}
                                onPress={() => {
                                    selectZone(item);
                                }}
                            >
                                <Text style={styles.pickerZoneLabel}>
                                    {item}
                                    {item === timezone ? ' ✓' : ''}
                                </Text>
                            </Pressable>
                        )}
                    />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#fff',
        flex: 1,
    },
    state: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    stateHint: {
        color: '#333',
        fontSize: 16,
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
    content: {
        paddingBottom: 32,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        color: '#000',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        color: '#333',
        fontSize: 15,
        marginBottom: 6,
    },
    input: {
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 16,
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
    zoneButton: {
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    zoneButtonLabel: {
        color: '#000',
        fontSize: 16,
    },
    fieldHint: {
        color: '#666',
        fontSize: 14,
        marginTop: 4,
    },
    formError: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    actionDisabled: {
        opacity: 0.6,
    },
    submit: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingVertical: 12,
    },
    submitLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    dangerWarning: {
        color: '#d32f2f',
        fontSize: 14,
        marginBottom: 12,
    },
    dangerButton: {
        alignItems: 'center',
        borderColor: '#d32f2f',
        borderRadius: 8,
        borderWidth: 1,
        paddingVertical: 12,
    },
    dangerButtonLabel: {
        color: '#d32f2f',
        fontSize: 16,
        fontWeight: '600',
    },
    dangerActions: {
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
    dangerSubmit: {
        alignItems: 'center',
        backgroundColor: '#d32f2f',
        borderRadius: 8,
        flex: 1,
        paddingVertical: 12,
    },
    dangerSubmitLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    donate: {
        alignItems: 'center',
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
        paddingVertical: 12,
    },
    donateLabel: {
        color: '#2f6fde',
        fontSize: 16,
        fontWeight: '600',
    },
    logout: {
        alignItems: 'center',
        backgroundColor: '#2f6fde',
        borderRadius: 8,
        paddingVertical: 12,
    },
    logoutLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    pickerScreen: {
        backgroundColor: '#fff',
        flex: 1,
    },
    pickerHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 8,
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    pickerTitle: {
        color: '#000',
        fontSize: 18,
        fontWeight: '600',
    },
    pickerCancel: {
        paddingVertical: 6,
    },
    pickerCancelLabel: {
        color: '#2f6fde',
        fontSize: 16,
    },
    pickerSearch: {
        borderColor: '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 16,
        marginHorizontal: 24,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    pickerList: {
        flex: 1,
    },
    pickerRegion: {
        backgroundColor: '#fff',
        color: '#666',
        fontSize: 13,
        fontWeight: '600',
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    pickerZone: {
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    pickerZoneLabel: {
        color: '#000',
        fontSize: 16,
    },
});
