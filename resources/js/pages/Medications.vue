<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { BookOpen, Plus } from '@lucide/vue';
import { computed, ref } from 'vue';
import MedicationNameController from '@/actions/App/Http/Controllers/MedicationNameController';
import MedicationFilters from '@/components/medications/MedicationFilters.vue';
import MedicationFormDialog from '@/components/medications/MedicationFormDialog.vue';
import MedicationRowMenu from '@/components/medications/MedicationRowMenu.vue';
import MedicationStatusBadge from '@/components/medications/MedicationStatusBadge.vue';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { Paginated } from '@/types/journal';
import type {
    MedicationFilters as MedicationFiltersValue,
    MedicationNameRow,
    MedicationRow,
} from '@/types/medications';

const props = defineProps<{
    medications: Paginated<MedicationRow>;
    filters: MedicationFiltersValue;
    medicationNames: MedicationNameRow[];
}>();

const filtersPanel = ref<InstanceType<typeof MedicationFilters> | null>(null);

// Пустой список отличаем по применённым (серверным) фильтрам: «Список пуст»
// без них, «Ничего не найдено» — с ними.
const hasAppliedFilters = computed(
    () =>
        props.filters.q !== null ||
        props.filters.from !== null ||
        props.filters.to !== null ||
        props.filters.status !== null,
);

// Только числовые чипы из `meta.links` — как в журнале.
const pageLinks = computed(() =>
    props.medications.meta.links.filter(
        (link) => link.url !== null && /^\d+$/.test(link.label),
    ),
);

function resetFilters(): void {
    filtersPanel.value?.reset();
}
</script>

<template>
    <Head title="Медикаменты" />

    <div class="flex min-w-0 flex-col gap-5 px-4 py-5 md:px-8 md:pt-7 md:pb-10">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-extrabold">Медикаменты</h1>

            <div class="flex items-center gap-2">
                <Button variant="outline" as-child>
                    <Link :href="MedicationNameController.index()">
                        <BookOpen class="size-4" />
                        Справочник
                    </Link>
                </Button>

                <MedicationFormDialog :names="medicationNames">
                    <template #trigger>
                        <Button>
                            <Plus class="size-4" />
                            Добавить
                        </Button>
                    </template>
                </MedicationFormDialog>
            </div>
        </div>

        <MedicationFilters ref="filtersPanel" :filters="filters" />

        <div
            v-if="medications.data.length > 0"
            class="min-w-0 rounded-2xl border border-border bg-card"
        >
            <!-- Table сам оборачивает таблицу в overflow-auto: на узкой
                 ширине скроллится только этот контейнер, а не страница. -->
            <Table class="min-w-[640px]">
                <TableHeader>
                    <TableRow>
                        <TableHead class="pl-4">Название</TableHead>
                        <TableHead>Дозировка</TableHead>
                        <TableHead>Начало</TableHead>
                        <TableHead>Окончание</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead class="w-12 pr-4">
                            <span class="sr-only">Действия</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-for="row in medications.data" :key="row.id">
                        <TableCell class="pl-4 font-semibold whitespace-normal">
                            {{ row.name }}
                        </TableCell>
                        <TableCell>{{ row.dosage_label }}</TableCell>
                        <TableCell>{{ row.start_label }}</TableCell>
                        <TableCell>{{ row.end_label ?? '—' }}</TableCell>
                        <TableCell>
                            <MedicationStatusBadge :status="row.status" />
                        </TableCell>
                        <TableCell class="pr-4 text-right">
                            <MedicationRowMenu
                                :row="row"
                                :names="medicationNames"
                            />
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>

        <div
            v-else-if="hasAppliedFilters"
            class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
        >
            Ничего не найдено
            <Button variant="outline" @click="resetFilters">
                Сбросить фильтры
            </Button>
        </div>

        <div
            v-else
            class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
        >
            Список пуст
            <MedicationFormDialog :names="medicationNames">
                <template #trigger>
                    <Button>
                        <Plus class="size-4" />
                        Добавить
                    </Button>
                </template>
            </MedicationFormDialog>
        </div>

        <nav
            v-if="pageLinks.length > 1"
            class="flex flex-wrap items-center gap-1.5"
            aria-label="Пагинация"
        >
            <Link
                v-for="link in pageLinks"
                :key="link.label"
                :href="link.url ?? ''"
                :class="[
                    'inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] px-3 text-sm font-semibold transition-colors',
                    link.active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-primary-soft hover:text-foreground',
                ]"
                :aria-current="link.active ? 'page' : undefined"
            >
                {{ link.label }}
            </Link>
        </nav>
    </div>
</template>
