<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import PeriodFilter from '@/components/journal/PeriodFilter.vue';
import SeizureTable from '@/components/journal/SeizureTable.vue';
import { dashboard } from '@/routes';
import type { JournalFilters, Paginated, SeizureRow } from '@/types/journal';

const props = defineProps<{
    seizures: Paginated<SeizureRow>;
    filters: JournalFilters;
}>();

defineOptions({
    layout: {
        breadcrumbs: [
            {
                title: 'Журнал приступов',
                href: dashboard(),
            },
        ],
    },
});

// Laravel's default paginator mixes numeric page links with HTML-arrow
// "Previous"/"Next" labels and "..." ellipsis slots. We only render the
// numeric ones — the first and last page links are enough to navigate.
const pageLinks = computed(() =>
    props.seizures.links.filter(
        (link) => link.url !== null && /^\d+$/.test(link.label),
    ),
);
</script>

<template>
    <Head title="Журнал приступов" />

    <div class="flex h-full flex-1 flex-col gap-6 p-4">
        <header class="space-y-1">
            <h1 class="text-xl font-semibold tracking-tight">
                Журнал приступов
            </h1>
            <p class="text-sm text-muted-foreground">
                Записи отображаются в вашем часовом поясе.
            </p>
        </header>

        <PeriodFilter :filters="filters" />

        <SeizureTable v-if="seizures.data.length > 0" :rows="seizures.data" />

        <div
            v-else
            class="rounded-lg border border-dashed border-sidebar-border/70 p-10 text-center text-sm text-muted-foreground dark:border-sidebar-border"
        >
            Записей за выбранный период нет
        </div>

        <nav
            v-if="pageLinks.length > 1"
            class="flex flex-wrap items-center gap-1"
            aria-label="Пагинация"
        >
            <Link
                v-for="link in pageLinks"
                :key="link.label"
                :href="link.url ?? ''"
                :class="[
                    'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm transition-colors',
                    link.active
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                ]"
                :aria-current="link.active ? 'page' : undefined"
            >
                {{ link.label }}
            </Link>
        </nav>
    </div>
</template>
