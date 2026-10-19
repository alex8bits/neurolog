<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import JournalPanel from '@/components/journal/JournalPanel.vue';
import MonthStrip from '@/components/journal/MonthStrip.vue';
import PeriodFilter from '@/components/journal/PeriodFilter.vue';
import SeizureDayList from '@/components/journal/SeizureDayList.vue';
import type {
    JournalFilters,
    JournalSummary,
    Paginated,
    SeizureRow,
} from '@/types/journal';
import { todayYmd as todayYmdFn } from '@/utils/dayGroups';

const props = defineProps<{
    seizures: Paginated<SeizureRow>;
    filters: JournalFilters;
    summary: JournalSummary;
}>();

// «Сегодня» в поясе профиля: заголовки дней сравнивают год с той же зоной,
// которой фильтрует сервер, — а не с поясом браузера.
const page = usePage();
const todayYmd = computed(() => todayYmdFn(page.props.auth.user.timezone));

// Laravel's default paginator mixes numeric page links with HTML-arrow
// "Previous"/"Next" labels and "..." ellipsis slots. The per-page chips live
// under `meta.links`; we only render the numeric ones.
const pageLinks = computed(() =>
    props.seizures.meta.links.filter(
        (link) => link.url !== null && /^\d+$/.test(link.label),
    ),
);
</script>

<template>
    <Head title="Журнал приступов" />

    <div
        class="grid grid-cols-1 gap-5 px-4 py-5 min-[900px]:grid-cols-[330px_minmax(0,1fr)] min-[900px]:gap-7 min-[900px]:px-8 min-[900px]:pt-7 min-[900px]:pb-10"
    >
        <JournalPanel :filters="filters" :summary="summary" />

        <section class="min-w-0">
            <MonthStrip :summary="summary" />

            <PeriodFilter :filters="filters" />

            <SeizureDayList
                v-if="seizures.data.length > 0"
                :rows="seizures.data"
                :today-ymd="todayYmd"
            />

            <div
                v-else
                class="mt-4 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
            >
                Записей за выбранный период нет
            </div>

            <nav
                v-if="pageLinks.length > 1"
                class="mt-5 flex flex-wrap items-center gap-1.5"
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
        </section>
    </div>
</template>
