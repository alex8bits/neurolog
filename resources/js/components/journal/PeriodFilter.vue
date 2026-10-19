<script setup lang="ts">
import { router, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboard } from '@/routes';
import type { JournalFilters } from '@/types/journal';
import { todayYmd } from '@/utils/dayGroups';

const props = defineProps<{ filters: JournalFilters }>();

const page = usePage();
const toError = ref<string | undefined>(
    (page.props.errors as Record<string, string> | undefined)?.to,
);

const from = ref<string>(props.filters.from ?? '');
const to = ref<string>(props.filters.to ?? '');

/** Чипы-пресеты периода — порт мобайлы (mobile/app/(journal)/index.tsx):
 *  «Всё время» последним, весь журнал остаётся явным выбором. */
const PERIOD_PRESETS = [
    { key: 'today', label: 'Сегодня' },
    { key: 'last7', label: '7 дней' },
    { key: 'last30', label: '30 дней' },
    { key: 'all', label: 'Всё время' },
] as const;

type PresetKey = (typeof PERIOD_PRESETS)[number]['key'];

/** Y-m-d ± N дней: конструктор Date сам разруливает переполнение
 *  дня/месяца/года; таймзоны не участвуют. */
function addDaysYmd(ymd: string, days: number): string {
    const [year, month, day] = ymd.split('-').map(Number);
    const date = new Date(year, month - 1, day + days);
    const pad = (value: number): string => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** «Сегодня» в поясе профиля — та же семантика «дня», что у серверного
 *  фильтра журнала и мобильного приложения. Computed: страница может
 *  пересидеть полночь в поясе профиля. */
const today = computed(() => todayYmd(page.props.auth.user.timezone));

/** Границы пресета (Y-m-d) либо null для «Всё время» — параметры from/to
 *  не шлются вовсе, только `all=1`. Пресеты заканчиваются сегодняшним
 *  днём включительно: last7 = сегодня-6..сегодня (7 календарных дней),
 *  last30 = сегодня-29..сегодня. Порт mobile/src/utils/period.ts. */
function presetRange(key: PresetKey): { from: string; to: string } | null {
    switch (key) {
        case 'today':
            return { from: today.value, to: today.value };
        case 'last7':
            return { from: addDaysYmd(today.value, -6), to: today.value };
        case 'last30':
            return { from: addDaysYmd(today.value, -29), to: today.value };
        case 'all':
            return null;
    }
}

/** Активный чип: текущие filters против границ пресетов на сегодня.
 *  Отдельной ветки для «пустых filters» не нужно: серверный дефолт
 *  (последние 7 дней) подставляется ещё в контроллере и возвращается
 *  заполненным — чистый вход подсвечивается общим циклом совпадения.
 *  Произвольный диапазон не совпадает ни с одним пресетом — подсветки
 *  нет. */
const activePreset = computed<PresetKey | null>(() => {
    const { from: fromFilter, to: toFilter, all } = props.filters;

    if (all) {
        return 'all';
    }

    for (const { key } of PERIOD_PRESETS) {
        const range = presetRange(key);

        if (
            range !== null &&
            range.from === fromFilter &&
            range.to === toFilter
        ) {
            return key;
        }
    }

    return null;
});

/** Общие опции применения фильтра: состояние страницы сохраняем, URL
 *  заменяем — история не засоряется переборами периода. */
function applyQuery(query: { from?: string; to?: string; all?: string }): void {
    router.get(dashboard().url, query, {
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

function apply(): void {
    const query: { from?: string; to?: string } = {};

    if (from.value) {
        query.from = from.value;
    }

    if (to.value) {
        query.to = to.value;
    }

    applyQuery(query);
}

function applyPreset(key: PresetKey): void {
    const range = presetRange(key);

    applyQuery(
        range === null ? { all: '1' } : { from: range.from, to: range.to },
    );
}
</script>

<template>
    <form class="mb-1 space-y-3" @submit.prevent="apply">
        <div
            class="flex w-max max-w-full flex-wrap gap-1.5 rounded-xl bg-muted p-1"
            role="group"
            aria-label="Быстрый выбор периода"
        >
            <button
                v-for="preset in PERIOD_PRESETS"
                :key="preset.key"
                type="button"
                :class="[
                    'cursor-pointer rounded-[9px] px-3.5 py-[7px] text-sm font-semibold transition-colors',
                    activePreset === preset.key
                        ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(22,50,58,0.12)]'
                        : 'text-muted-foreground hover:text-foreground',
                ]"
                :aria-pressed="activePreset === preset.key"
                @click="applyPreset(preset.key)"
            >
                {{ preset.label }}
            </button>
            <span
                v-if="activePreset === null"
                class="rounded-[9px] bg-card px-3.5 py-[7px] text-sm font-semibold text-foreground shadow-[0_1px_2px_rgba(22,50,58,0.12)]"
            >
                Свой период
            </span>
        </div>

        <div class="flex flex-wrap items-end gap-3">
            <div class="grid gap-1.5">
                <Label for="from">Дата начала</Label>
                <Input id="from" v-model="from" type="date" name="from" />
            </div>

            <div class="grid gap-1.5">
                <Label for="to">Дата конца</Label>
                <Input id="to" v-model="to" type="date" name="to" />
                <InputError :message="toError" />
            </div>

            <Button type="submit" variant="outline">Показать</Button>
        </div>
    </form>
</template>
