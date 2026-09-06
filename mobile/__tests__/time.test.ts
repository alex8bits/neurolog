import { describe, expect, it } from 'vitest';

import { formatLocalDateTime, parseUtcIso } from '@/utils/time';

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
