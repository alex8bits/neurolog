/**
 * Дозировка лекарства: показ и ввод. Платформо-независимый модуль — без
 * импортов React/RN. Сервер хранит decimal(8,2) и отдаёт строку с двумя
 * знаками ("750.00"); на экране — без хвостовых нулей, с запятой.
 */

import type { MedicationUnit } from '@/api/types';

const UNIT_LABELS: Record<MedicationUnit, string> = {
    mg: 'мг',
    ml: 'мл',
};

/** "750.00" → "750", "2.50" → "2,5", "0.25" → "0,25". */
function trimDecimal(dosage: string): string {
    const value = dosage.trim();

    if (!value.includes('.')) {
        return value;
    }

    return value.replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

/** Как на сервере: "750.00" + mg → "750мг", "2.50" + ml → "2,5мл". */
export function formatDosage(dosage: string, unit: MedicationUnit): string {
    return `${trimDecimal(dosage)}${UNIT_LABELS[unit]}`;
}

/** Значение поля ввода для API: trim, запятая → точка ("2,5" → "2.5");
 *  пустая строка остаётся пустой (её отклонит серверная валидация). */
export function normalizeDosageInput(raw: string): string {
    return raw.trim().replace(',', '.');
}

/** Дозировка с сервера → начальное значение поля формы правки. */
export function dosageToInput(dosage: string): string {
    return trimDecimal(dosage);
}
