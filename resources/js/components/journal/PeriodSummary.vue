<script setup lang="ts">
import { computed } from 'vue';
import type { JournalFilters, JournalSummary } from '@/types/journal';

const props = defineProps<{
    filters: JournalFilters;
    summary: JournalSummary;
}>();

function addDaysYmd(ymd: string, days: number): string {
    const [year, month, day] = ymd.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day + days))
        .toISOString()
        .slice(0, 10);
}

/** Заголовок по тем же границам пресетов, что в PeriodFilter. */
const title = computed(() => {
    const { from, to, all } = props.filters;
    const today = props.summary.today;

    if (all) {
        return 'ИТОГИ · ВСЁ ВРЕМЯ';
    }

    if (to === today) {
        if (from === today) {
            return 'ИТОГИ · СЕГОДНЯ';
        }

        if (from === addDaysYmd(today, -6)) {
            return 'ИТОГИ · 7 ДНЕЙ';
        }

        if (from === addDaysYmd(today, -29)) {
            return 'ИТОГИ · 30 ДНЕЙ';
        }
    }

    return 'ИТОГИ · СВОЙ ПЕРИОД';
});
</script>

<template>
    <div>
        <small class="text-[13px] font-semibold text-muted-foreground">
            {{ title }}
        </small>
        <div
            class="flex items-baseline justify-between py-1.5 text-sm font-semibold text-muted-foreground"
        >
            <span>Приступов</span>
            <b class="text-xl font-extrabold text-foreground">
                {{ summary.period.total }}
            </b>
        </div>
        <div
            class="flex items-baseline justify-between py-1.5 text-sm font-semibold text-muted-foreground"
        >
            <span>Дней с приступами</span>
            <b class="text-xl font-extrabold text-foreground">
                {{ summary.period.days_with_seizures }}
            </b>
        </div>
    </div>
</template>
