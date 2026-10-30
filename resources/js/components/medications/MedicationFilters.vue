<script setup lang="ts">
import { router, usePage } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, ref } from 'vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { index as medicationsIndex } from '@/routes/medications';
import type { MedicationFilters, MedicationStatus } from '@/types/medications';

const props = defineProps<{ filters: MedicationFilters }>();

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: { key: MedicationStatus | null; label: string }[] = [
    { key: null, label: 'Все' },
    { key: 'planned', label: 'Запланировано' },
    { key: 'active', label: 'Идёт приём' },
    { key: 'finished', label: 'Окончен' },
];

const page = usePage();
const toError = ref<string | undefined>(
    (page.props.errors as Record<string, string> | undefined)?.to,
);

// Локальное состояние: инициализируется из применённых фильтров и дальше
// живёт само (preserveState сохраняет его между визитами).
const q = ref<string>(props.filters.q ?? '');
const from = ref<string>(props.filters.from ?? '');
const to = ref<string>(props.filters.to ?? '');
const status = ref<MedicationStatus | null>(props.filters.status);

const hasActiveFilters = computed(
    () =>
        q.value.trim() !== '' ||
        from.value !== '' ||
        to.value !== '' ||
        status.value !== null,
);

let searchTimer: ReturnType<typeof setTimeout> | undefined;

function cancelPendingSearch(): void {
    if (searchTimer !== undefined) {
        clearTimeout(searchTimer);
        searchTimer = undefined;
    }
}

onBeforeUnmount(cancelPendingSearch);

/** Query только из непустых значений; `page` не передаётся — смена
 *  фильтра возвращает на первую страницу. */
function apply(): void {
    cancelPendingSearch();

    const query: Record<string, string> = {};
    const search = q.value.trim();

    if (search !== '') {
        query.q = search;
    }

    if (from.value) {
        query.from = from.value;
    }

    if (to.value) {
        query.to = to.value;
    }

    if (status.value !== null) {
        query.status = status.value;
    }

    router.get(medicationsIndex().url, query, {
        preserveState: true,
        replace: true,
        onError: (errors) => {
            toError.value = (errors as Record<string, string>).to;
        },
        onSuccess: () => {
            toError.value = undefined;
        },
    });
}

function onSearchInput(value: string | number): void {
    q.value = String(value);
    cancelPendingSearch();
    searchTimer = setTimeout(apply, SEARCH_DEBOUNCE_MS);
}

function selectStatus(key: MedicationStatus | null): void {
    if (status.value === key) {
        return;
    }

    status.value = key;
    apply();
}

function reset(): void {
    q.value = '';
    from.value = '';
    to.value = '';
    status.value = null;
    apply();
}

defineExpose({ reset });
</script>

<template>
    <form class="space-y-3" role="search" @submit.prevent="apply">
        <div class="flex flex-wrap items-end gap-3">
            <div class="grid min-w-0 flex-1 basis-56 gap-1.5">
                <Label for="medications-q">Название</Label>
                <Input
                    id="medications-q"
                    type="search"
                    name="q"
                    :model-value="q"
                    maxlength="100"
                    placeholder="Например, депакин"
                    autocomplete="off"
                    @update:model-value="onSearchInput"
                />
            </div>

            <div class="grid gap-1.5">
                <Label for="medications-from">Период от</Label>
                <Input
                    id="medications-from"
                    v-model="from"
                    type="date"
                    name="from"
                    @change="apply"
                />
            </div>

            <div class="grid gap-1.5">
                <Label for="medications-to">до</Label>
                <Input
                    id="medications-to"
                    v-model="to"
                    type="date"
                    name="to"
                    @change="apply"
                />
                <InputError :message="toError" />
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
            <div
                class="flex w-max max-w-full flex-wrap gap-1.5 rounded-xl bg-muted p-1"
                role="group"
                aria-label="Статус приёма"
            >
                <button
                    v-for="option in STATUS_OPTIONS"
                    :key="option.key ?? 'all'"
                    type="button"
                    :class="[
                        'cursor-pointer rounded-[9px] px-3.5 py-[7px] text-sm font-semibold transition-colors',
                        status === option.key
                            ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(22,50,58,0.12)]'
                            : 'text-muted-foreground hover:text-foreground',
                    ]"
                    :aria-pressed="status === option.key"
                    @click="selectStatus(option.key)"
                >
                    {{ option.label }}
                </button>
            </div>

            <Button
                v-if="hasActiveFilters"
                type="button"
                variant="ghost"
                @click="reset"
            >
                Сбросить
            </Button>
        </div>
    </form>
</template>
