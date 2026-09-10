<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue';
import { computed } from 'vue';
import DeleteSeizureDialog from '@/components/journal/DeleteSeizureDialog.vue';
import EditSeizureDialog from '@/components/journal/EditSeizureDialog.vue';
import { Button } from '@/components/ui/button';
import type { SeizureRow } from '@/types/journal';
import {
    formatDayTitle,
    groupRowsByDay,
    pluralizeSeizures,
} from '@/utils/dayGroups';

const props = defineProps<{
    rows: SeizureRow[];
    todayYmd: string;
}>();

const groups = computed(() => groupRowsByDay(props.rows));
</script>

<template>
    <div class="w-full">
        <!-- Полоса группы тянется на всю ширину контентной области: страница
             журнала даёт боковые отступы p-4, поэтому -mx-4 расширяет фон до
             краёв, а px-4 возвращает содержимое к общим отступам. -->
        <section
            v-for="(group, index) in groups"
            :key="group.key"
            class="-mx-4 px-4"
            :class="index % 2 === 1 ? 'bg-muted/50' : undefined"
        >
            <h2 class="pt-3 pb-1 text-xs font-semibold text-muted-foreground">
                {{ formatDayTitle(group.key, todayYmd) }} ·
                {{ group.rows.length }}
                {{ pluralizeSeizures(group.rows.length) }}
            </h2>

            <ul>
                <!-- Разделитель — только между строками группы: последняя
                     строка границы не получает (last:border-b-0). -->
                <li
                    v-for="row in group.rows"
                    :key="row.id"
                    class="flex items-start justify-between gap-3 border-b border-border/40 py-2 text-sm last:border-b-0"
                >
                    <div class="flex min-w-0 flex-1 items-baseline gap-3">
                        <span class="shrink-0 font-semibold tabular-nums">
                            {{ row.time }}
                        </span>
                        <p
                            v-if="row.comment !== null"
                            class="line-clamp-3 min-w-0 flex-1 text-muted-foreground"
                        >
                            {{ row.comment }}
                        </p>
                    </div>

                    <div class="flex shrink-0 gap-1">
                        <EditSeizureDialog :row="row">
                            <template #trigger>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Редактировать запись"
                                >
                                    <Pencil />
                                </Button>
                            </template>
                        </EditSeizureDialog>

                        <DeleteSeizureDialog :row="row">
                            <template #trigger>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Удалить запись"
                                >
                                    <Trash2 />
                                </Button>
                            </template>
                        </DeleteSeizureDialog>
                    </div>
                </li>
            </ul>
        </section>
    </div>
</template>
