<script setup lang="ts">
import { computed } from 'vue';
import type { JournalSummary } from '@/types/journal';
import { pluralizeSeizures } from '@/utils/dayGroups';

const props = defineProps<{ summary: JournalSummary }>();

const MONTHS_GENITIVE = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
];

const MONTHS_SHORT = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
];

const COLORS = ['bg-strip-0', 'bg-strip-1', 'bg-strip-2', 'bg-strip-3'];

function parts(ymd: string): { day: number; month: number } {
    const [, month, day] = ymd.split('-').map(Number);

    return { day, month: month - 1 };
}

function pluralizeDays(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return 'день';
    }

    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
        return 'дня';
    }

    return 'дней';
}

const cells = computed(() =>
    props.summary.days.map((day, index, all) => {
        const { day: d, month } = parts(day.date);
        const date = `${d} ${MONTHS_GENITIVE[month]}`;

        return {
            date: day.date,
            text:
                day.count === 0
                    ? `${date} — без приступов`
                    : `${date} — ${day.count} ${pluralizeSeizures(day.count)}`,
            color: COLORS[Math.min(day.count, 3)],
            isLast: index === all.length - 1,
        };
    }),
);

const daysWithSeizures = computed(
    () => props.summary.days.filter((day) => day.count > 0).length,
);

const startLabel = computed(() => {
    const first = props.summary.days[0];

    if (first === undefined) {
        return '';
    }

    const { day, month } = parts(first.date);

    return `${day} ${MONTHS_SHORT[month]}`;
});
</script>

<template>
    <section class="mb-4 rounded-2xl bg-card px-[18px] pt-4 pb-3">
        <h2
            class="flex items-baseline justify-between text-[15px] font-extrabold"
        >
            Последние 30 дней
            <span class="text-xs font-semibold text-muted-foreground">
                {{ daysWithSeizures }}
                {{ pluralizeDays(daysWithSeizures) }} с приступами
            </span>
        </h2>

        <div class="mt-3 mb-1 grid grid-cols-30 gap-[3px]">
            <i
                v-for="cell in cells"
                :key="cell.date"
                class="block h-[30px] rounded-[5px]"
                :class="[
                    cell.color,
                    cell.isLast
                        ? 'outline-2 outline-offset-1 outline-foreground'
                        : '',
                ]"
                :title="cell.text"
                :aria-label="cell.text"
            ></i>
        </div>

        <div
            class="flex justify-between text-[11px] font-semibold text-muted-foreground"
        >
            <span>{{ startLabel }}</span>
            <span>сегодня</span>
        </div>
    </section>
</template>
