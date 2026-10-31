<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { Plus } from '@lucide/vue';
import MedicationNameFormDialog from '@/components/medication-names/MedicationNameFormDialog.vue';
import MedicationNameRowMenu from '@/components/medication-names/MedicationNameRowMenu.vue';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { index as medicationsIndex } from '@/routes/medications';
import type { MedicationNameRow } from '@/types/medications';

defineProps<{ medicationNames: MedicationNameRow[] }>();
</script>

<template>
    <Head title="Справочник лекарств" />

    <div class="flex min-w-0 flex-col gap-5 px-4 py-5 md:px-8 md:pt-7 md:pb-10">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-col gap-1">
                <h1 class="text-2xl font-extrabold">Справочник лекарств</h1>
                <Link
                    :href="medicationsIndex()"
                    class="text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                    ← Медикаменты
                </Link>
            </div>

            <MedicationNameFormDialog>
                <template #trigger>
                    <Button>
                        <Plus class="size-4" />
                        Добавить
                    </Button>
                </template>
            </MedicationNameFormDialog>
        </div>

        <div
            v-if="medicationNames.length > 0"
            class="min-w-0 rounded-2xl border border-border bg-card"
        >
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead class="pl-4">Название</TableHead>
                        <TableHead>Используется</TableHead>
                        <TableHead class="w-12 pr-4">
                            <span class="sr-only">Действия</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow v-for="entry in medicationNames" :key="entry.id">
                        <TableCell class="pl-4 font-semibold whitespace-normal">
                            {{ entry.name }}
                        </TableCell>
                        <TableCell>
                            {{
                                entry.medications_count > 0
                                    ? entry.medications_count
                                    : '—'
                            }}
                        </TableCell>
                        <TableCell class="pr-4 text-right">
                            <MedicationNameRowMenu :entry="entry" />
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>

        <div
            v-else
            class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
        >
            Справочник пуст
            <MedicationNameFormDialog>
                <template #trigger>
                    <Button>
                        <Plus class="size-4" />
                        Добавить
                    </Button>
                </template>
            </MedicationNameFormDialog>
        </div>
    </div>
</template>
