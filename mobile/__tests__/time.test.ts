import { describe, expect, it } from 'vitest';

import {
    formatLocalDateTime,
    formatYmd,
    isBeyondNowPlusMinutes,
    parseUtcIso,
    toNaiveLocalIso,
} from '@/utils/time';

describe('parseUtcIso', () => {
    it('парсит серверный формат с 6 дробными знаками', () => {
        expect(parseUtcIso('2026-05-10T09:15:00.000000Z')?.toISOString()).toBe(
            '2026-05-10T09:15:00.000Z',
        );
    });

    it('усекает микросекунды до миллисекунд, а не округляет', () => {
        expect(parseUtcIso('2026-05-10T09:15:00.123456Z')?.toISOString()).toBe(
            '2026-05-10T09:15:00.123Z',
        );
    });

    it('допускает строки без дробной части и с 3 знаками', () => {
        expect(parseUtcIso('2026-05-10T09:15:00Z')).toBeInstanceOf(Date);
        expect(parseUtcIso('2026-05-10T09:15:00.123Z')).toBeInstanceOf(Date);
    });

    it('граница суток: нулевые поля дают ровно Date.UTC(2026, 0, 1)', () => {
        expect(parseUtcIso('2026-01-01T00:00:00.000000Z')?.getTime()).toBe(
            Date.UTC(2026, 0, 1),
        );
    });

    it('мусор → null: смещение вместо Z, месяц 13, пустая строка, локальный формат', () => {
        expect(parseUtcIso('2026-05-10T09:15:00.000000+03:00')).toBeNull();
        expect(parseUtcIso('2026-13-01T00:00:00.000000Z')).toBeNull();
        expect(parseUtcIso('')).toBeNull();
        expect(parseUtcIso('10.05.2026 09:15')).toBeNull();
    });
});

describe('formatLocalDateTime', () => {
    const iso = '2026-05-10T09:15:00.000000Z';

    it('собирает «ДД.ММ.ГГГГ, ЧЧ:ММ» из локальных геттеров того же Date', () => {
        const formatted = formatLocalDateTime(iso);

        expect(formatted).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);

        const d = parseUtcIso(iso)!;
        const pad = (part: number) => String(part).padStart(2, '0');

        expect(formatted).toBe(
            `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
    });

    it('непарсируемое значение возвращает как есть', () => {
        expect(formatLocalDateTime('мусор')).toBe('мусор');
    });
});

describe('formatYmd', () => {
    it('дополняет нулями месяц и день < 10', () => {
        expect(formatYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('обычная дата проходит без паддинга компонентов', () => {
        expect(formatYmd(new Date(2026, 10, 21))).toBe('2026-11-21');
    });
});

describe('toNaiveLocalIso', () => {
    it('собирает YYYY-MM-DDTHH:mm:ss из локальных геттеров: без Z, без смещения, секунды с паддингом', () => {
        const naive = toNaiveLocalIso(new Date(2026, 4, 10, 9, 5, 0));

        expect(naive).toBe('2026-05-10T09:05:00');
        expect(naive).not.toMatch(/(Z|[+-]\d{2}:?\d{2})$/i);
    });
});

describe('isBeyondNowPlusMinutes', () => {
    const now = new Date(Date.UTC(2026, 4, 10, 9, 0, 0));

    const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

    it('ровно now + 5 минут → false: граница разрешена', () => {
        expect(isBeyondNowPlusMinutes(at(5 * 60_000), 5, now)).toBe(false);
    });

    it('now + 5 минут + 1 секунда → true', () => {
        expect(isBeyondNowPlusMinutes(at(5 * 60_000 + 1000), 5, now)).toBe(
            true,
        );
    });

    it('now + 4 минуты → false', () => {
        expect(isBeyondNowPlusMinutes(at(4 * 60_000), 5, now)).toBe(false);
    });

    it('прошлое (now − 1 час) → false', () => {
        expect(isBeyondNowPlusMinutes(at(-60 * 60_000), 5, now)).toBe(false);
    });
});
