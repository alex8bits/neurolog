import { describe, expect, it } from 'vitest';

import { formatDosage, normalizeDosageInput } from '@/utils/dosage';

describe('formatDosage', () => {
    it('отбрасывает нулевую дробную часть', () => {
        expect(formatDosage('750.00', 'mg')).toBe('750мг');
    });

    it('хвостовой ноль убирается, разделитель — запятая', () => {
        expect(formatDosage('2.50', 'ml')).toBe('2,5мл');
    });
});

describe('normalizeDosageInput', () => {
    it('запятая превращается в точку', () => {
        expect(normalizeDosageInput('2,5')).toBe('2.5');
    });
});
