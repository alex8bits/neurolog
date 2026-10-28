import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    SectionList,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    changePassword,
    deleteAccount,
    fetchProfile,
    updateProfile,
} from '@/api/profile';
import type { TimezoneGroup, UserProfile } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { AppText } from '@/components/ui/AppText';
import { DangerButton } from '@/components/ui/DangerButton';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { useConnectivity } from '@/offline/ConnectivityContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { ApiError, userMessage } from '@/utils/errors';

/** Серверные лимиты правки профиля (ProfileUpdateRequest): name и
 *  email — string|max:255; maxLength зеркалирует их до запроса. */
const NAME_MAX_LENGTH = 255;
const EMAIL_MAX_LENGTH = 255;

const GENERIC_ERROR_TEXT = 'Сервер недоступен, попробуйте позже.';

/** Текст ошибки загрузки: ApiError — по kind (userMessage), неожиданное —
 *  общий текст. */
function loadErrorText(error: unknown): string {
    return error instanceof ApiError ? userMessage(error) : GENERIC_ERROR_TEXT;
}

/**
 * Текст предупреждения о выходе с неотправленными записями: согласование
 * «запись / записи / записей» и «не отправлена / не отправлены» по
 * правилам pluralizeSeizures (utils/dayGroups.ts).
 */
function unsentWarningText(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return `${n} запись ещё не отправлена на сервер и будет удалена с телефона.`;
    }

    const noun =
        mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)
            ? 'записи'
            : 'записей';

    return `${n} ${noun} ещё не отправлены на сервер и будут удалены с телефона.`;
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
 * Android нет. Смена пароля — PATCH /profile/password: текущий +
 * новый + подтверждение, 422 мапится в подсветку полей, после успеха
 * поля очищаются (токены живы, перелогин не нужен). Внизу — опасная
 * зона: удаление аккаунта (DELETE /profile с подтверждением паролем;
 * успех → только локальный signOutLocally, токены уже отозваны
 * сервером, на логин уводит гвард корня) и выход.
 */
export default function SettingsScreen() {
    const { logout, updateEmail, signOutLocally } = useAuth();
    const { pendingCount, failedCount } = useConnectivity();

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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {},
    );

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

    // --- Смена пароля ---
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Ошибки смены пароля живут отдельно — та же логика, что у зоны
    // удаления: сообщения и подсветка видны рядом с полями этой формы
    // и не стирают подсветку полей профиля.
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordFieldErrors, setPasswordFieldErrors] = useState<
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

    /** Ввод после ошибки смены пароля: гасим ошибки только этой формы. */
    function clearPasswordError(field: string): void {
        setPasswordError(null);

        setPasswordFieldErrors((prev) => {
            if (!(field in prev)) {
                return prev;
            }

            const next = { ...prev };

            delete next[field];

            return next;
        });
    }

    /** «Сменить пароль»: клиентски проверяем непустоту и совпадение
     *  подтверждения, дальше PATCH; успех чистит поля (сессия жива —
     *  токены сервер не отзывает), 422 — подсветка полей. */
    async function onChangePassword(): Promise<void> {
        const errors: Record<string, string[]> = {};

        if (currentPassword === '') {
            errors.current_password = ['Введите текущий пароль.'];
        }

        if (newPassword === '') {
            errors.password = ['Введите новый пароль.'];
        }

        if (newPasswordConfirmation === '') {
            errors.password_confirmation = ['Повторите новый пароль.'];
        } else if (newPassword !== newPasswordConfirmation) {
            errors.password_confirmation = ['Пароли не совпадают.'];
        }

        if (Object.keys(errors).length > 0) {
            setPasswordFieldErrors(errors);
            setPasswordError(null);

            return;
        }

        setChangingPassword(true);
        setPasswordError(null);
        setPasswordFieldErrors({});

        try {
            await changePassword({
                current_password: currentPassword,
                password: newPassword,
                password_confirmation: newPasswordConfirmation,
            });

            setCurrentPassword('');
            setNewPassword('');
            setNewPasswordConfirmation('');

            Alert.alert('', 'Пароль обновлён');
        } catch (error) {
            if (
                error instanceof ApiError &&
                error.kind === 'validation' &&
                error.fieldErrors !== undefined &&
                Object.keys(error.fieldErrors).length > 0
            ) {
                setPasswordFieldErrors(error.fieldErrors);
            } else {
                setPasswordError(
                    error instanceof ApiError
                        ? userMessage(error)
                        : GENERIC_ERROR_TEXT,
                );
            }
        } finally {
            setChangingPassword(false);
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

    /** Выход (логика прежнего экрана настроек): гвард сам уведёт на
     *  /(auth)/login после смены статуса. Выход стирает локальный журнал и
     *  очередь — если в ней есть неотправленные записи, сначала
     *  подтверждение с их количеством. */
    function onLogout(): void {
        const unsent = pendingCount + failedCount;

        if (unsent === 0) {
            void doLogout();

            return;
        }

        Alert.alert('Выйти?', unsentWarningText(unsent), [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Выйти',
                style: 'destructive',
                onPress: () => void doLogout(),
            },
        ]);
    }

    async function doLogout(): Promise<void> {
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
                    <AppText variant="body" color="muted">
                        Загрузка…
                    </AppText>
                </View>
            ) : null}

            {profile === null && loadError !== null ? (
                <View style={styles.state}>
                    <AppText
                        variant="label"
                        color="danger"
                        style={styles.stateError}
                    >
                        {loadError}
                    </AppText>
                    <PrimaryButton
                        title="Повторить"
                        style={styles.retry}
                        onPress={() => {
                            setReloadSeq((seq) => seq + 1);
                        }}
                    />
                </View>
            ) : null}

            {profile !== null ? (
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.section}>
                        <AppText
                            variant="caption"
                            color="muted"
                            style={styles.sectionTitle}
                        >
                            Профиль
                        </AppText>

                        <TextField
                            label="Имя"
                            value={name}
                            onChangeText={(value) => {
                                setName(value);
                                clearError('name');
                            }}
                            error={fieldErrors.name?.join(' ')}
                            accessibilityLabel="Имя"
                            maxLength={NAME_MAX_LENGTH}
                        />

                        <TextField
                            label="Email"
                            value={email}
                            onChangeText={(value) => {
                                setEmail(value);
                                clearError('email');
                            }}
                            error={fieldErrors.email?.join(' ')}
                            accessibilityLabel="Email"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={EMAIL_MAX_LENGTH}
                        />

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Часовой пояс: ${timezone}`}
                            style={[
                                styles.zoneField,
                                fieldErrors.timezone && styles.zoneFieldErrored,
                            ]}
                            onPress={() => {
                                setPickerVisible(true);
                            }}
                        >
                            <AppText
                                variant="caption"
                                color="muted"
                                style={styles.zoneLabel}
                            >
                                Часовой пояс
                            </AppText>
                            <AppText variant="body">{timezone}</AppText>
                        </Pressable>
                        <AppText
                            variant="caption"
                            color="muted"
                            style={styles.fieldHint}
                        >
                            Время приступов отображается и экспортируется в этом
                            поясе.
                        </AppText>
                        {fieldErrors.timezone ? (
                            <AppText
                                variant="caption"
                                color="danger"
                                style={styles.fieldError}
                            >
                                {fieldErrors.timezone.join(' ')}
                            </AppText>
                        ) : null}

                        {formError ? (
                            <AppText
                                variant="label"
                                color="danger"
                                style={styles.formError}
                            >
                                {formError}
                            </AppText>
                        ) : null}

                        <PrimaryButton
                            title={submitting ? 'Сохраняем…' : 'Сохранить'}
                            disabled={submitting}
                            onPress={onSubmit}
                            style={styles.action}
                        />
                    </View>

                    <View style={styles.section}>
                        <AppText
                            variant="caption"
                            color="muted"
                            style={styles.sectionTitle}
                        >
                            Смена пароля
                        </AppText>

                        <TextField
                            label="Текущий пароль"
                            value={currentPassword}
                            onChangeText={(value) => {
                                setCurrentPassword(value);
                                clearPasswordError('current_password');
                            }}
                            error={passwordFieldErrors.current_password?.join(
                                ' ',
                            )}
                            accessibilityLabel="Текущий пароль"
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TextField
                            label="Новый пароль"
                            value={newPassword}
                            onChangeText={(value) => {
                                setNewPassword(value);
                                clearPasswordError('password');
                            }}
                            error={passwordFieldErrors.password?.join(' ')}
                            accessibilityLabel="Новый пароль"
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TextField
                            label="Новый пароль ещё раз"
                            value={newPasswordConfirmation}
                            onChangeText={(value) => {
                                setNewPasswordConfirmation(value);
                                clearPasswordError('password_confirmation');
                            }}
                            error={passwordFieldErrors.password_confirmation?.join(
                                ' ',
                            )}
                            accessibilityLabel="Новый пароль ещё раз"
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        {passwordError ? (
                            <AppText
                                variant="label"
                                color="danger"
                                style={styles.formError}
                            >
                                {passwordError}
                            </AppText>
                        ) : null}

                        <PrimaryButton
                            title={
                                changingPassword
                                    ? 'Сохраняем…'
                                    : 'Сменить пароль'
                            }
                            disabled={changingPassword}
                            onPress={onChangePassword}
                            style={styles.action}
                        />
                    </View>

                    <View style={styles.section}>
                        <AppText
                            variant="caption"
                            color="muted"
                            style={styles.sectionTitle}
                        >
                            Удаление аккаунта
                        </AppText>
                        <AppText
                            variant="label"
                            color="danger"
                            style={styles.dangerWarning}
                        >
                            Удаление аккаунта необратимо: будут удалены все
                            записи журнала.
                        </AppText>

                        {confirmDelete ? (
                            <View>
                                <TextField
                                    label="Пароль"
                                    value={password}
                                    onChangeText={(value) => {
                                        setPassword(value);
                                        clearDeleteError('password');
                                    }}
                                    error={deleteFieldErrors.password?.join(
                                        ' ',
                                    )}
                                    accessibilityLabel="Пароль"
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {deleteError ? (
                                    <AppText
                                        variant="caption"
                                        color="danger"
                                        style={styles.fieldError}
                                    >
                                        {deleteError}
                                    </AppText>
                                ) : null}
                                <View style={styles.dangerActions}>
                                    <OutlineButton
                                        title="Отмена"
                                        style={styles.dangerAction}
                                        onPress={cancelDelete}
                                    />
                                    <DangerButton
                                        title={
                                            deleting
                                                ? 'Удаляем…'
                                                : 'Удалить навсегда'
                                        }
                                        disabled={deleting}
                                        style={styles.dangerAction}
                                        onPress={onDelete}
                                    />
                                </View>
                            </View>
                        ) : (
                            <DangerButton
                                title="Удалить аккаунт"
                                onPress={() => {
                                    setConfirmDelete(true);
                                }}
                            />
                        )}
                    </View>

                    <OutlineButton
                        title={loggingOut ? 'Выходим…' : 'Выйти'}
                        disabled={loggingOut}
                        onPress={onLogout}
                    />
                </ScrollView>
            ) : null}

            <Modal
                visible={pickerVisible}
                transparent
                animationType="slide"
                onRequestClose={closePicker}
            >
                <View style={styles.pickerBackdrop}>
                    <View
                        style={[
                            styles.pickerSheet,
                            { paddingBottom: insets.bottom + spacing.lg },
                        ]}
                    >
                        <View style={styles.pickerHeader}>
                            <AppText variant="heading">Часовой пояс</AppText>
                            <Pressable
                                accessibilityRole="button"
                                style={styles.pickerCancel}
                                onPress={closePicker}
                            >
                                <AppText variant="label" color="primary">
                                    Отмена
                                </AppText>
                            </Pressable>
                        </View>
                        <TextField
                            label="Поиск"
                            value={pickerSearch}
                            onChangeText={setPickerSearch}
                            accessibilityLabel="Поиск часового пояса"
                            autoCapitalize="none"
                            autoCorrect={false}
                            containerStyle={styles.pickerSearch}
                        />
                        <SectionList
                            style={styles.pickerList}
                            sections={pickerSections}
                            keyExtractor={(zone) => zone}
                            keyboardShouldPersistTaps="handled"
                            renderSectionHeader={({ section }) => (
                                <AppText
                                    variant="caption"
                                    color="muted"
                                    style={styles.pickerRegion}
                                >
                                    {section.title}
                                </AppText>
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
                                    <AppText
                                        variant="body"
                                        color={
                                            item === timezone
                                                ? 'primary'
                                                : 'text'
                                        }
                                    >
                                        {item}
                                        {item === timezone ? ' ✓' : ''}
                                    </AppText>
                                </Pressable>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: colors.background,
        flex: 1,
    },
    state: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xxl,
    },
    stateError: {
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    retry: {
        paddingHorizontal: spacing.xxxl,
    },
    content: {
        gap: spacing.lg,
        paddingBottom: spacing.xxxl,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },
    section: {
        backgroundColor: colors.surface,
        borderRadius: radius.sheet,
        padding: spacing.xl,
    },
    sectionTitle: {
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    zoneField: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: radius.control,
        borderWidth: 1.5,
        marginBottom: spacing.sm + 2,
        paddingHorizontal: spacing.lg - 2,
        paddingVertical: spacing.sm + 2,
    },
    zoneFieldErrored: {
        borderColor: colors.danger,
    },
    zoneLabel: {
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.44,
        textTransform: 'uppercase',
    },
    fieldHint: {
        marginLeft: spacing.xs,
        marginBottom: spacing.sm,
    },
    fieldError: {
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
    formError: {
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    action: {
        marginTop: spacing.xs,
    },
    dangerWarning: {
        marginBottom: spacing.md,
    },
    dangerActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xs,
    },
    dangerAction: {
        flex: 1,
    },
    pickerBackdrop: {
        backgroundColor: colors.overlay,
        flex: 1,
        justifyContent: 'flex-end',
    },
    pickerSheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        height: '80%',
        paddingTop: spacing.lg,
    },
    pickerHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.xxl,
    },
    pickerCancel: {
        justifyContent: 'center',
        minHeight: 44,
    },
    pickerSearch: {
        marginBottom: spacing.sm,
        marginHorizontal: spacing.xxl,
    },
    pickerList: {
        flex: 1,
    },
    pickerRegion: {
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    pickerZone: {
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.md,
    },
});
