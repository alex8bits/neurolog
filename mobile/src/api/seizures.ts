import { apiFetch } from '@/api/client';
import type {
    CreateSeizureInput,
    ListSeizuresParams,
    Seizure,
    SeizureListResponse,
    SeizureResponse,
} from '@/api/types';

/** Этап 2 фиксирует per_page=50 (PLAN.md); максимум сервера — 100. */
const PER_PAGE = 50;

export async function listSeizures(
    params: ListSeizuresParams,
): Promise<SeizureListResponse> {
    let query = `per_page=${PER_PAGE}&timezone=${encodeURIComponent(params.timezone)}`;

    if (params.from !== undefined) {
        query += `&from=${encodeURIComponent(params.from)}`;
    }

    if (params.to !== undefined) {
        query += `&to=${encodeURIComponent(params.to)}`;
    }

    return apiFetch<SeizureListResponse>(`/seizures?${query}`);
}

export async function createSeizure(
    input: CreateSeizureInput,
): Promise<Seizure> {
    const response = await apiFetch<SeizureResponse>('/seizures', {
        method: 'POST',
        body: input,
    });

    return response.data;
}

export async function deleteSeizure(id: number): Promise<void> {
    await apiFetch<void>(`/seizures/${id}`, { method: 'DELETE' });
}
