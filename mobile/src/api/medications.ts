import { apiFetch } from '@/api/client';
import type {
    Medication,
    MedicationFilters,
    MedicationInput,
    MedicationListResponse,
    MedicationResponse,
} from '@/api/types';
import { deviceTimezone } from '@/config/timezone';

/** Размер страницы списка лекарств. */
const PER_PAGE = 20;

/**
 * Query GET /medications: per_page и timezone (статус считается на сервере
 * относительно «сегодня» в поясе устройства) — всегда; q — только непустой
 * после trim; from/to/status — при наличии; page — последним (первая
 * загрузка его не шлёт, сервер отдаёт страницу 1).
 */
export function medicationsQuery(
    filters: MedicationFilters,
    page?: number,
): string {
    let query = `per_page=${PER_PAGE}&timezone=${encodeURIComponent(deviceTimezone())}`;

    const q = filters.q?.trim() ?? '';

    if (q !== '') {
        query += `&q=${encodeURIComponent(q)}`;
    }

    if (filters.from !== undefined) {
        query += `&from=${encodeURIComponent(filters.from)}`;
    }

    if (filters.to !== undefined) {
        query += `&to=${encodeURIComponent(filters.to)}`;
    }

    if (filters.status !== undefined) {
        query += `&status=${encodeURIComponent(filters.status)}`;
    }

    if (page !== undefined) {
        query += `&page=${page}`;
    }

    return query;
}

export async function listMedications(
    filters: MedicationFilters,
    page?: number,
): Promise<MedicationListResponse> {
    return apiFetch<MedicationListResponse>(
        `/medications?${medicationsQuery(filters, page)}`,
    );
}

/** POST /medications (201); 422 — ApiError('validation') с fieldErrors. */
export async function createMedication(
    input: MedicationInput,
): Promise<Medication> {
    const response = await apiFetch<MedicationResponse>('/medications', {
        method: 'POST',
        body: input,
    });

    return response.data;
}

/** PATCH /medications/{id}: тело и 422 — как у create, 404 — чужая запись. */
export async function updateMedication(
    id: number,
    input: MedicationInput,
): Promise<Medication> {
    const response = await apiFetch<MedicationResponse>(`/medications/${id}`, {
        method: 'PATCH',
        body: input,
    });

    return response.data;
}

export async function deleteMedication(id: number): Promise<void> {
    await apiFetch<void>(`/medications/${id}`, { method: 'DELETE' });
}
