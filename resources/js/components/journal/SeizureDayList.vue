<script setup lang="ts">
import { computed } from 'vue';
import SeizureRow from '@/components/journal/SeizureRow.vue';
import type { SeizureRow as SeizureRowType } from '@/types/journal';
import {
    formatDayTitle,
    groupRowsByDay,
    pluralizeSeizures,
} from '@/utils/dayGroups';

const props = defineProps<{
    rows: SeizureRowType[];
    todayYmd: string;
}>();

const groups = computed(() => groupRowsByDay(props.rows));
</script>

<template>
    <div class="w-full">
        <section v-for="group in groups" :key="group.key">
            <h2
                class="mt-3.5 mb-1.5 flex items-baseline justify-between font-extrabold"
            >
                <b
                    class="font-extrabold"
                    :class="
                        group.key === todayYmd
                            ? 'rounded-lg bg-sun-soft px-2.5 py-0.5'
                            : ''
                    "
                >
                    {{
                        group.key === todayYmd
                            ? `Сегодня, ${formatDayTitle(group.key, todayYmd)}`
                            : formatDayTitle(group.key, todayYmd)
                    }}
                </b>
                <span class="text-[13px] font-semibold text-muted-foreground">
                    {{ group.rows.length }}
                    {{ pluralizeSeizures(group.rows.length) }}
                </span>
            </h2>

            <ul class="overflow-hidden rounded-2xl bg-card">
                <SeizureRow
                    v-for="row in group.rows"
                    :key="row.id"
                    :row="row"
                />
            </ul>
        </section>
    </div>
</template>
