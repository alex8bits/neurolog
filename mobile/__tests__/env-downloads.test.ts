import { describe, expect, it } from 'vitest';

import { downloadsUrls } from '@/config/env';

describe('downloadsUrls', () => {
    it('прод: срезает /api/v1 и отдаёт адреса меты и APK в корне origin', () => {
        expect(downloadsUrls('https://seizure.godnocode.ru/api/v1')).toEqual({
            metaUrl: 'https://seizure.godnocode.ru/downloads/app-release.json',
            apkUrl: 'https://seizure.godnocode.ru/downloads/seizure.apk',
        });
    });

    it('эмулятор: дефолтный базовый URL тоже приводит к корню хоста', () => {
        expect(downloadsUrls('http://10.0.2.2:8100/api/v1')).toEqual({
            metaUrl: 'http://10.0.2.2:8100/downloads/app-release.json',
            apkUrl: 'http://10.0.2.2:8100/downloads/seizure.apk',
        });
    });

    it('база без суффикса /api/v1 → passthrough без среза (fail-open)', () => {
        expect(downloadsUrls('https://example.com')).toEqual({
            metaUrl: 'https://example.com/downloads/app-release.json',
            apkUrl: 'https://example.com/downloads/seizure.apk',
        });
    });

    it('суффикс /api/v1 в середине строки не трогается: срезается один раз', () => {
        expect(downloadsUrls('https://x/api/v1/api/v1')).toEqual({
            metaUrl: 'https://x/api/v1/downloads/app-release.json',
            apkUrl: 'https://x/api/v1/downloads/seizure.apk',
        });
    });

    it('похожий, но не равный суффикс (/api/v10) не срезается — passthrough', () => {
        expect(downloadsUrls('https://example.com/api/v10')).toEqual({
            metaUrl: 'https://example.com/api/v10/downloads/app-release.json',
            apkUrl: 'https://example.com/api/v10/downloads/seizure.apk',
        });
    });

    it('хвостовой слэш в базе не даёт двойного слэша: /api/v1/ → корень origin', () => {
        expect(downloadsUrls('https://x/api/v1/')).toEqual({
            metaUrl: 'https://x/downloads/app-release.json',
            apkUrl: 'https://x/downloads/seizure.apk',
        });
    });
});
