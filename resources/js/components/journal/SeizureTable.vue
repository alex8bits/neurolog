<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue';
import DeleteSeizureDialog from '@/components/journal/DeleteSeizureDialog.vue';
import EditSeizureDialog from '@/components/journal/EditSeizureDialog.vue';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { SeizureRow } from '@/types/journal';

defineProps<{ rows: SeizureRow[] }>();
</script>

<template>
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Время</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead class="w-px text-right whitespace-nowrap">
                    Действия
                </TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            <TableRow v-for="row in rows" :key="row.id">
                <TableCell>{{ row.date }}</TableCell>
                <TableCell>{{ row.time }}</TableCell>
                <TableCell>{{ row.comment ?? '—' }}</TableCell>
                <TableCell class="text-right">
                    <div class="flex justify-end gap-1">
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
                </TableCell>
            </TableRow>
        </TableBody>
    </Table>
</template>
