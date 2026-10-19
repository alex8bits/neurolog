import { describe, expect, it } from 'vitest';

import { computeStripLevels, stripLevel } from '@/utils/stripLevel';

const days = (counts: number[]) => counts.map((count) => ({ count }));

describe('computeStripLevels', () => {
    it('max=8: границы уровней 2/3 и 5/6', () => {
        expect(computeStripLevels(days([0, 1, 2, 3, 5, 6, 8]))).toEqual([
            0, 1, 1, 2, 2, 3, 3,
        ]);
    });

    it('max<=3: шкала абсолютная', () => {
        expect(computeStripLevels(days([0, 1, 2, 3]))).toEqual([0, 1, 2, 3]);
        expect(computeStripLevels(days([1]))).toEqual([1]);
    });

    it('нули и отрицательные — уровень 0', () => {
        expect(stripLevel(0, 8)).toBe(0);
        expect(stripLevel(-1, 8)).toBe(0);
    });
});
