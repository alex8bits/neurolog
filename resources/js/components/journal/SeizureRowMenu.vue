<script setup lang="ts">
import { ref } from 'vue';
import DeleteSeizureDialog from '@/components/journal/DeleteSeizureDialog.vue';
import EditSeizureDialog from '@/components/journal/EditSeizureDialog.vue';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SeizureRow } from '@/types/journal';

const props = defineProps<{ row: SeizureRow }>();

const editOpen = ref(false);
const editFocus = ref<'comment' | undefined>(undefined);
const deleteOpen = ref(false);

function openEdit(focus?: 'comment'): void {
    editFocus.value = focus;
    editOpen.value = true;
}
</script>

<template>
    <!-- Триггер — вся строка (слот); диалоги живут снаружи меню, чтобы не
         закрываться вместе с ним. -->
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <slot />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
            <DropdownMenuItem @select="openEdit()">Изменить</DropdownMenuItem>
            <DropdownMenuItem @select="openEdit('comment')">
                {{
                    props.row.comment === null
                        ? 'Добавить комментарий'
                        : 'Изменить комментарий'
                }}
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

    <EditSeizureDialog v-model:open="editOpen" :row="row" :focus="editFocus" />
    <DeleteSeizureDialog v-model:open="deleteOpen" :row="row" />
</template>
