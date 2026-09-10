const DEFAULT_API_BASE_URL = 'http://10.0.2.2:8100/api/v1'; // Android-эмулятор → localhost машины (порт docker-стека)

export const API_BASE_URL: string = (
    process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, ''); // хвостовые «/» из .env не должны давать «…/v1//login»

const API_PREFIX = '/api/v1';

/** Адреса статики релиза: мету и APK раздаёт сайт из корня origin
 *  (scripts/publish-apk.sh), отдельной env-переменной нет — выводим
 *  из базового URL API срезом префикса /api/v1. */
export function downloadsUrls(apiBaseUrl: string): {
    metaUrl: string;
    apkUrl: string;
} {
    const base = apiBaseUrl.replace(/\/+$/, ''); // хвостовые «/» не должны давать «…/v1//downloads/…»
    const origin = base.endsWith(API_PREFIX)
        ? base.slice(0, base.length - API_PREFIX.length)
        : base;

    return {
        metaUrl: `${origin}/downloads/app-release.json`,
        apkUrl: `${origin}/downloads/seizure.apk`,
    };
}

export const { metaUrl: RELEASE_META_URL, apkUrl: APK_DOWNLOAD_URL } =
    downloadsUrls(API_BASE_URL);
