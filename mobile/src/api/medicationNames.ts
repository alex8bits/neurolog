import { apiFetch } from '@/api/client';
import type { MedicationName, MedicationNameListResponse } from '@/api/types';

/** GET /medication-names — весь справочник пользователя, по имени. */
export async function listMedicationNames(): Promise<MedicationName[]> {
    const response =
        await apiFetch<MedicationNameListResponse>('/medication-names');

    return response.data;
}
