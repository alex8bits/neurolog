<script setup lang="ts">
import { Ellipsis } from '@lucide/vue';
import { computed, ref } from 'vue';
import DeleteMedicationNameDialog from '@/components/medication-names/DeleteMedicationNameDialog.vue';
import MedicationNameFormDialog from '@/components/medication-names/MedicationNameFormDialog.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MedicationNameRow } from '@/types/medications';

const props = defineProps<{ entry: MedicationNameRow }>();

const editOpen = ref(false);
const deleteOpen = ref(false);

const inUse = computed(() => props.entry.medications_count > 0);
const inUseHint = computed(() =>
    inUse.value ? 'Используется в медикаментах' : undefined,
);
</script>

<template>
    <!-- Диалоги живут снаружи меню, чтобы не закрываться вместе с ним. -->
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button
                variant="ghost"
                size="icon"
                class="size-8"
                :aria-label="`Действия: ${props.entry.name}`"
            >
                <Ellipsis class="size-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuItem @select="editOpen = true">
                Переименовать
            </DropdownMenuItem>
            <DropdownMenuItem
                variant="destructive"
                class="text-destructive focus:text-destructive"
                :disabled="inUse"
                :title="inUseHint"
                :aria-description="inUseHint"
                @select="deleteOpen = true"
            >
                Удалить
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>

    <MedicationNameFormDialog v-model:open="editOpen" :entry="entry" />
    <DeleteMedicationNameDialog v-model:open="deleteOpen" :entry="entry" />
</template>
