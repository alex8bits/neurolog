<script setup lang="ts">
import { computed } from 'vue';
import type { JournalSummary } from '@/types/journal';
import { pluralizeSeizures } from '@/utils/dayGroups';
import { weekFromSummary } from '@/utils/weekDays';

const props = defineProps<{ summary: JournalSummary }>();

const week = computed(() =>
    weekFromSummary(props.summary.today, props.summary.days),
);

function label(day: { ymd: string; count: number | null }): string {
    if (day.count === null) {
        return day.ymd;
    }

    return `${day.ymd}: ${day.count} ${pluralizeSeizures(day.count)}`;
}
</script>

<template>
    <div>
        <small class="text-[13px] font-semibold text-muted-foreground">
            Эта неделя
        </small>
        <div class="mt-2.5 grid grid-cols-7 gap-1.5">
            <div
                v-for="day in week"
                :key="day.ymd"
                class="text-center text-[11px] font-semibold text-muted-foreground"
                :title="label(day)"
                :aria-label="label(day)"
            >
                {{ day.weekday }}
                <b
                    class="mx-auto mt-1 block size-7 rounded-full text-xs leading-7 font-bold"
                    :class="[
                        day.count === null
                            ? 'bg-muted text-muted-foreground/60'
                            : day.count > 0
                              ? 'bg-sun text-foreground'
                              : 'bg-primary-soft text-foreground',
                        day.isToday
                            ? 'outline-2 outline-offset-2 outline-foreground'
                            : '',
                    ]"
                >
                    {{ day.dayNumber }}
                </b>
            </div>
        </div>
    </div>
</template>
