<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
import MedicationController from '@/actions/App/Http/Controllers/MedicationController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import type { MedicationRow } from '@/types/medications';

const props = defineProps<{ row: MedicationRow }>();

// Управляемый (v-model:open из меню строки) либо самодостаточный (слот trigger).
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
    <Dialog v-model:open="open">
        <DialogTrigger v-if="$slots.trigger" as-child>
            <slot name="trigger" />
        </DialogTrigger>
        <DialogContent>
            <Form
                v-bind="MedicationController.destroy.form(props.row.id)"
                :options="{ preserveScroll: true }"
                @success="open = false"
                class="space-y-5"
                v-slot="{ processing }"
            >
                <DialogHeader class="space-y-3">
                    <DialogTitle class="text-xl font-extrabold">
                        Удалить «{{ props.row.name }}»?
                    </DialogTitle>
                    <DialogDescription>
                        Действие можно отменить только вручную через
                        администратора.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter class="gap-2">
                    <DialogClose as-child>
                        <Button variant="outline" :disabled="processing">
                            Отмена
                        </Button>
                    </DialogClose>

                    <Button
                        type="submit"
                        variant="destructive"
                        :disabled="processing"
                    >
                        Удалить
                    </Button>
                </DialogFooter>
            </Form>
        </DialogContent>
    </Dialog>
</template>
