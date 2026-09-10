import { describe, expect, it } from 'vitest';

import { isNewerVersion, shouldPromptForUpdate } from '@/updates/version';

describe('isNewerVersion', () => {
    it('«0.0.10» новее «0.0.9» — численно, где строка ошиблась бы', () => {
        expect(isNewerVersion('0.0.10', '0.0.9')).toBe(true);
    });

    it('«1.10.0» новее «1.2.3» по minor — тоже численно', () => {
        expect(isNewerVersion('1.10.0', '1.2.3')).toBe(true);
    });

    it('равные версии — не новее', () => {
        expect(isNewerVersion('0.0.5', '0.0.5')).toBe(false);
    });

    it('старый кандидат — не новее', () => {
        expect(isNewerVersion('0.0.4', '0.0.5')).toBe(false);
    });

    it('пустой/битый кандидат — false при валидном installed', () => {
        expect(isNewerVersion('', '0.0.5')).toBe(false);
        expect(isNewerVersion('0.5', '0.0.5')).toBe(false);
        expect(isNewerVersion('0.0.5-beta', '0.0.5')).toBe(false);
        expect(isNewerVersion('dev', '0.0.5')).toBe(false);
        expect(isNewerVersion('x.y.z', '0.0.5')).toBe(false);
    });

    it('пустой/битый installed — false при валидном кандидате', () => {
        expect(isNewerVersion('0.0.6', '')).toBe(false);
        expect(isNewerVersion('0.0.6', '0.5')).toBe(false);
        expect(isNewerVersion('0.0.6', '0.0.5-beta')).toBe(false);
        expect(isNewerVersion('0.0.6', 'dev')).toBe(false);
        expect(isNewerVersion('0.0.6', 'x.y.z')).toBe(false);
    });
});

describe('shouldPromptForUpdate', () => {
    it('мета новее установленной, отказа нет → true', () => {
        expect(
            shouldPromptForUpdate({
                metaVersion: '0.0.6',
                installedVersion: '0.0.5',
                dismissedVersion: null,
            }),
        ).toBe(true);
    });

    it('отказ сохранён ровно для версии меты → false', () => {
        expect(
            shouldPromptForUpdate({
                metaVersion: '0.0.6',
                installedVersion: '0.0.5',
                dismissedVersion: '0.0.6',
            }),
        ).toBe(false);
    });

    it('отказ от старой версии не гасит новую мету → true', () => {
        expect(
            shouldPromptForUpdate({
                metaVersion: '0.0.6',
                installedVersion: '0.0.5',
                dismissedVersion: '0.0.4',
            }),
        ).toBe(true);
    });

    it('отказ с битым значением не блокирует промпт (гасится только строгое равенство)', () => {
        expect(
            shouldPromptForUpdate({
                metaVersion: '0.0.6',
                installedVersion: '0.0.5',
                dismissedVersion: 'garbage',
            }),
        ).toBe(true);
    });

    it('нет меты / нет установленной / версии равны → false', () => {
        expect(
            shouldPromptForUpdate({
                metaVersion: null,
                installedVersion: '0.0.5',
                dismissedVersion: null,
            }),
        ).toBe(false);
        expect(
            shouldPromptForUpdate({
                metaVersion: '0.0.6',
                installedVersion: null,
                dismissedVersion: null,
            }),
        ).toBe(false);
        expect(
            shouldPromptForUpdate({
                metaVersion: '0.0.5',
                installedVersion: '0.0.5',
                dismissedVersion: null,
            }),
        ).toBe(false);
    });

    it('битая установленная версия → false', () => {
        expect(
            shouldPromptForUpdate({
                metaVersion: '1.0.0',
                installedVersion: 'not-a-version',
                dismissedVersion: null,
            }),
        ).toBe(false);
    });
});
