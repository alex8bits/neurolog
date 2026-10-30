<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import type { MedicationStatus } from '@/types/medications';

const props = defineProps<{ status: MedicationStatus }>();

const STATUS_VIEW: Record<MedicationStatus, { label: string; class: string }> =
    {
        planned: {
            label: 'Запланировано',
            class: 'border-transparent bg-sun-soft text-foreground',
        },
        active: {
            label: 'Идёт приём',
            class: 'border-transparent bg-primary-soft text-primary',
        },
        finished: {
            label: 'Приём окончен',
            class: 'border-transparent bg-muted text-muted-foreground',
        },
    };

const view = computed(() => STATUS_VIEW[props.status]);
</script>

<template>
    <Badge variant="outline" :class="['font-semibold', view.class]">
        {{ view.label }}
    </Badge>
</template>
