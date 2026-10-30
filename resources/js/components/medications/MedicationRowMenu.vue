<script setup lang="ts">
import { Ellipsis } from '@lucide/vue';
import { ref } from 'vue';
import DeleteMedicationDialog from '@/components/medications/DeleteMedicationDialog.vue';
import MedicationFormDialog from '@/components/medications/MedicationFormDialog.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MedicationRow } from '@/types/medications';

const props = defineProps<{ row: MedicationRow }>();

const editOpen = ref(false);
const deleteOpen = ref(false);
</script>

<template>
    <!-- Диалоги живут снаружи меню, чтобы не закрываться вместе с ним. -->
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button
                variant="ghost"
                size="icon"
                class="size-8"
                :aria-label="`Действия: ${props.row.name}`"
            >
                <Ellipsis class="size-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
            <DropdownMenuItem @select="editOpen = true">
                Изменить
            </DropdownMenuItem>
            <DropdownMenuItem
                variant="destructive"
                class="text-destructive focus:text-destructive"
                @select="deleteOpen = true"
            >
                Удалить
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>

    <MedicationFormDialog v-model:open="editOpen" :row="row" />
    <DeleteMedicationDialog v-model:open="deleteOpen" :row="row" />
</template>
