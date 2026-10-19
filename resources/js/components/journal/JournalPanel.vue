<script setup lang="ts">
import CreateSeizureDialog from '@/components/journal/CreateSeizureDialog.vue';
import PeriodSummary from '@/components/journal/PeriodSummary.vue';
import RecordButton from '@/components/journal/RecordButton.vue';
import ReportActions from '@/components/journal/ReportActions.vue';
import WeekStrip from '@/components/journal/WeekStrip.vue';
import type { JournalFilters, JournalSummary } from '@/types/journal';

defineProps<{
    filters: JournalFilters;
    summary: JournalSummary;
}>();
</script>

<template>
    <!-- Закрепляется только на широком экране; на узком — обычный блок
         над лентой. -->
    <aside
        class="space-y-4 self-start rounded-[20px] bg-card p-6 min-[900px]:sticky min-[900px]:top-3"
    >
        <div>
            <RecordButton />

            <CreateSeizureDialog>
                <template #trigger>
                    <button
                        type="button"
                        class="mt-2 block w-full cursor-pointer text-center text-sm font-semibold text-primary hover:underline"
                    >
                        Указать другое время
                    </button>
                </template>
            </CreateSeizureDialog>
        </div>

        <hr class="border-border" />
        <WeekStrip :summary="summary" />

        <hr class="border-border" />
        <PeriodSummary :filters="filters" :summary="summary" />

        <hr class="border-border" />
        <ReportActions :filters="filters" />
    </aside>
</template>
