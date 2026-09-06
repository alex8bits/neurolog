import { getCalendars } from 'expo-localization';

/** IANA-пояс устройства; при неопределённости — 'UTC' (сервер и так дефолтит). */
export function deviceTimezone(): string {
    const tz = getCalendars().find((calendar) => calendar.timeZone)?.timeZone;

    return tz && tz.includes('/') ? tz : 'UTC'; // дешёвая проверка «похоже на IANA»
}
