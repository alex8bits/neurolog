import { onMounted, ref } from 'vue';
import type { Ref } from 'vue';

// Публикуется скриптом mobile/scripts/publish-apk.sh в public/downloads/.
// Имя файла фиксировано, поэтому ссылка стабильна между релизами; мета
// пишется рядом. Нет меты — APK не публиковали, пункт меню не показываем.
export const APP_DOWNLOAD_URL = '/downloads/seizure.apk';

// Сборы добровольных пожертвований (Т-Банк и Сбер) — внешние страницы,
// открываются в новой вкладке. Ссылка Сбера — короткий адрес его
// мессенджера, счёт в банке иметь не обязательно.
export const DONATE_URLS = [
    { label: 'Т-Банк', url: 'https://www.tbank.ru/cf/41k9RdG5ibo' },
    {
        label: 'Сбербанк',
        url: 'https://messenger.sbrf.ru/sl/4YhMIBtzuatnweYM0',
    },
];

/** Версия опубликованного APK (null — не опубликован или мета недоступна). */
export function useAppDownload(): { appVersion: Ref<string | null> } {
    const appVersion = ref<string | null>(null);

    onMounted(() => {
        fetch('/downloads/app-release.json', {
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (!response.ok) {
                    return;
                }

                const meta: { version?: unknown } = await response.json();

                if (
                    typeof meta.version === 'string' &&
                    meta.version.length > 0
                ) {
                    appVersion.value = meta.version;
                }
            })
            .catch(() => {
                // Сеть недоступна или мета не опубликована — прячем пункт.
            });
    });

    return { appVersion };
}
