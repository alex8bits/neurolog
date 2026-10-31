<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
import { computed } from 'vue';
import MedicationNameController from '@/actions/App/Http/Controllers/MedicationNameController';
import InputError from '@/components/InputError.vue';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MedicationNameRow } from '@/types/medications';

const props = defineProps<{
    /** Задан — переименование этой позиции; не задан — создание. */
    entry?: MedicationNameRow;
}>();

// Управляемый (v-model:open из меню строки) либо самодостаточный (слот trigger).
const open = defineModel<boolean>('open', { default: false });

const formDefinition = computed(() =>
    props.entry
        ? MedicationNameController.update.form(props.entry.id)
        : MedicationNameController.store.form(),
);
</script>

<template>
    <Dialog v-model:open="open">
        <DialogTrigger v-if="$slots.trigger" as-child>
            <slot name="trigger" />
        </DialogTrigger>
        <DialogContent>
            <Form
                v-bind="formDefinition"
                :options="{ preserveScroll: true }"
                @success="open = false"
                novalidate
                class="space-y-5"
                v-slot="{ errors, processing }"
            >
                <DialogHeader class="space-y-2">
                    <DialogTitle class="text-xl font-extrabold">
                        {{ props.entry ? 'Переименовать' : 'Новое лекарство' }}
                    </DialogTitle>
                    <DialogDescription v-if="props.entry">
                        Новое название появится во всех медикаментах и отчётах.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label
                        for="medication-name-input"
                        class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                        >Название</Label
                    >
                    <Input
                        id="medication-name-input"
                        name="name"
                        :default-value="props.entry?.name ?? ''"
                        maxlength="255"
                        required
                    />
                    <InputError :message="errors.name" />
                </div>

                <DialogFooter class="gap-2">
                    <DialogClose as-child>
                        <Button variant="outline" :disabled="processing">
                            Отмена
                        </Button>
                    </DialogClose>

                    <Button type="submit" :disabled="processing">
                        Сохранить
                    </Button>
                </DialogFooter>
            </Form>
        </DialogContent>
    </Dialog>
</template>
