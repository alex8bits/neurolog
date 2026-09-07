import { describe, expect, it } from 'vitest';

import type { Seizure } from '@/api/types';
import {
    formatDayTitle,
    groupSeizuresByDay,
    pluralizeSeizures,
} from '@/utils/dayGroups';
import { parseUtcIso } from '@/utils/time';

/** Серверный формат occurred_at из локального Date: UTC ISO с шестью
 *  дробными знаками и Z — как отдаёт SeizureResource. */
const serverIso = (local: Date) =>
    `${local.toISOString().slice(0, 19)}.000000Z`;

/** Минимальная запись списка: остальные поля группе не нужны. */
const seizure = (id: number, occurredAt: string): Seizure => ({
    id,
    occurred_at: occurredAt,
    comment: null,
    created_at: null,
});

describe('groupSeizuresByDay', () => {
    it('пустой список → пустой массив групп', () => {
        expect(groupSeizuresByDay([])).toEqual([]);
    });

    it('записи вокруг локальной полуночи разносятся в разные дни', () => {
        // 23:30 и 00:30 следующего дня по локали — независимо от пояса
        // устройства это два разных календарных дня.
        const late = seizure(1, serverIso(new Date(2026, 8, 6, 23, 30)));
        const early = seizure(2, serverIso(new Date(2026, 8, 7, 0, 30)));
        const groups = groupSeizuresByDay([late, early]);

        expect(groups).toHaveLength(2);

        const lateDay = parseUtcIso(late.occurred_at)!;

        // Ключ — локальный Y-m-d момента, день — та же локальная дата.
        expect(groups[0]?.key).toBe(
            `${lateDay.getFullYear()}-${String(lateDay.getMonth() + 1).padStart(2, '0')}-${String(lateDay.getDate()).padStart(2, '0')}`,
        );
        expect(groups[0]?.day.getDate()).toBe(lateDay.getDate());
        expect(groups[0]?.day.getMonth()).toBe(lateDay.getMonth());
        expect(groups[0]?.day.getFullYear()).toBe(lateDay.getFullYear());
        expect(groups[0]?.items).toEqual([late]);
        expect(groups[1]?.items).toEqual([early]);
    });

    it('записи одного дня схлопываются в одну группу: count и порядок внутри сохранены', () => {
        const first = seizure(1, serverIso(new Date(2026, 8, 7, 14, 25)));
        const second = seizure(2, serverIso(new Date(2026, 8, 7, 9, 0)));
        const third = seizure(3, serverIso(new Date(2026, 8, 7, 23, 59)));
        const groups = groupSeizuresByDay([first, second, third]);

        expect(groups).toHaveLength(1);
        expect(groups[0]?.count).toBe(3);
        expect(groups[0]?.items).toEqual([first, second, third]);
    });

    it('порядок групп — по первому появлению дня, пересортировки нет', () => {
        // Сервер отдаёт occurred_at DESC; на всякий порядок подтверждаем
        // как есть: 7-е, потом 6-е, потом снова 7-е — 7-е не «всплывает».
        const a1 = seizure(1, serverIso(new Date(2026, 8, 7, 10, 0)));
        const b = seizure(2, serverIso(new Date(2026, 8, 6, 10, 0)));
        const a2 = seizure(3, serverIso(new Date(2026, 8, 7, 12, 0)));
        const groups = groupSeizuresByDay([a1, b, a2]);

        expect(groups).toHaveLength(2);
        expect(groups[0]?.items).toEqual([a1, a2]);
        expect(groups[0]?.count).toBe(2);
        expect(groups[1]?.items).toEqual([b]);
        expect(groups[1]?.count).toBe(1);
    });

    it('day группы — локальная полночь: время дня обнулено', () => {
        const groups = groupSeizuresByDay([
            seizure(1, serverIso(new Date(2026, 8, 7, 14, 25))),
        ]);

        const day = groups[0]?.day;

        expect(day?.getHours()).toBe(0);
        expect(day?.getMinutes()).toBe(0);
    });

    it('непарсируемый occurred_at пропускается и не создаёт группу', () => {
        const good = seizure(1, serverIso(new Date(2026, 8, 7, 14, 25)));
        const groups = groupSeizuresByDay([
            seizure(2, 'мусор'),
            good,
            seizure(3, '2026-09-07T14:25:00+03:00'),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]?.items).toEqual([good]);
        expect(groups[0]?.count).toBe(1);
    });
});

describe('formatDayTitle', () => {
    it('текущий год — «7 сентября» без года', () => {
        const thisYear = new Date().getFullYear();

        expect(formatDayTitle(new Date(thisYear, 8, 7))).toBe('7 сентября');
    });

    it('не-текущий год — год дописывается через пробел', () => {
        const otherYear = new Date().getFullYear() + 1;

        expect(formatDayTitle(new Date(otherYear, 8, 7))).toBe(
            `7 сентября ${otherYear}`,
        );
    });

    it('все месяцы — в родительном падеже', () => {
        const year = new Date().getFullYear();
        const expected = [
            '1 января',
            '1 февраля',
            '1 марта',
            '1 апреля',
            '1 мая',
            '1 июня',
            '1 июля',
            '1 августа',
            '1 сентября',
            '1 октября',
            '1 ноября',
            '1 декабря',
        ];

        expect(
            expected.map((_label, month) =>
                formatDayTitle(new Date(year, month, 1)),
            ),
        ).toEqual(expected);
    });
});

describe('pluralizeSeizures', () => {
    it.each([
        [1, 'приступ'],
        [2, 'приступа'],
        [3, 'приступа'],
        [4, 'приступа'],
        [5, 'приступов'],
        [11, 'приступов'],
        [12, 'приступов'],
        [14, 'приступов'],
        [21, 'приступ'],
        [22, 'приступа'],
        [24, 'приступа'],
        [25, 'приступов'],
        [111, 'приступов'],
    ])('%d → «%s»', (n, word) => {
        expect(pluralizeSeizures(n)).toBe(word);
    });
});
