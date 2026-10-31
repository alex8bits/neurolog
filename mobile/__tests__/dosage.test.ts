import { describe, expect, it } from 'vitest';

import { formatDosage, normalizeDosageInput } from '@/utils/dosage';

describe('formatDosage', () => {
    it('отбрасывает нулевую дробную часть', () => {
        expect(formatDosage('750.00', 'mg')).toBe('750мг');
    });

    it('хвостовой ноль убирается, разделитель — запятая', () => {
        expect(formatDosage('2.50', 'ml')).toBe('2,5мл');
        expect(formatDosage('2.00000', 'pil')).toBe('2таб');
    });
});

describe('formatDosage, пять знаков', () => {
    it('сохраняет значимые дробные знаки', () => {
        expect(formatDosage('0.00125', 'mg')).toBe('0,00125мг');
    });
});

describe('normalizeDosageInput', () => {
    it('запятая превращается в точку', () => {
        expect(normalizeDosageInput('2,5')).toBe('2.5');
    });
});
