import { apiFetch } from '@/api/client';
import type {
    ProfileResponse,
    UpdatePasswordInput,
    UpdateProfileInput,
    UserProfile,
} from '@/api/types';

/** GET /profile: текущий профиль + сгруппированный список поясов для
 *  селектора настроек (один источник с правилом валидации timezone). */
export async function fetchProfile(): Promise<ProfileResponse> {
    return apiFetch<ProfileResponse>('/profile');
}

/** PATCH /profile: правка name/email/timezone; 422 маппится в ApiError c
 *  fieldErrors полей. Ответ — только обёртка data, без timezones. */
export async function updateProfile(
    input: UpdateProfileInput,
): Promise<UserProfile> {
    const response = await apiFetch<{ data: UserProfile }>('/profile', {
        method: 'PATCH',
        body: input,
    });

    return response.data;
}

/** PATCH /profile/password: смена пароля с подтверждением текущим; 422 —
 *  неверный текущий/слабый новый (errors по полям). 204 — пароль изменён,
 *  токены сервер не отзывает, перелогин не нужен. */
export async function changePassword(
    input: UpdatePasswordInput,
): Promise<void> {
    await apiFetch<void>('/profile/password', {
        method: 'PATCH',
        body: input,
    });
}

/** DELETE /profile: удаление аккаунта с подтверждением паролем (422 —
 *  неверный пароль, errors.password); 204 — сервер отзывает токены и
 *  удаляет данные каскадами, дальше нужен только локальный выход. */
export async function deleteAccount(password: string): Promise<void> {
    await apiFetch<void>('/profile', { method: 'DELETE', body: { password } });
}
