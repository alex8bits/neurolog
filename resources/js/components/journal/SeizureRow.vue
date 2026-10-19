<script setup lang="ts">
import SeizureRowMenu from '@/components/journal/SeizureRowMenu.vue';
import type { SeizureRow } from '@/types/journal';

defineProps<{ row: SeizureRow }>();
</script>

<template>
    <li class="border-b border-border last:border-b-0">
        <SeizureRowMenu :row="row">
            <button
                type="button"
                class="grid w-full cursor-pointer grid-cols-[56px_1fr_auto] items-center gap-2.5 px-4 py-[7px] text-left transition-colors hover:bg-primary-soft/50 focus-visible:bg-primary-soft/50 focus-visible:outline-none"
                :aria-label="`Запись в ${row.time}: действия`"
            >
                <time class="text-base font-extrabold tabular-nums">
                    {{ row.time }}
                </time>
                <p
                    v-if="row.comment !== null"
                    class="line-clamp-3 min-w-0 text-sm leading-[1.3] text-foreground/80"
                >
                    {{ row.comment }}
                </p>
                <!-- Нет комментария: пустая ячейка сохраняет колонку для «···» -->
                <span v-else></span>
                <span
                    class="text-xl leading-none tracking-[2px] text-muted-foreground"
                    aria-hidden="true"
                    >···</span
                >
            </button>
        </SeizureRowMenu>
    </li>
</template>
