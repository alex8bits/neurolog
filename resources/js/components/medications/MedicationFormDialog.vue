<script setup lang="ts">
import { Form, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import MedicationController from '@/actions/App/Http/Controllers/MedicationController';
import InputError from '@/components/InputError.vue';
import MedicationNameCombobox from '@/components/medications/MedicationNameCombobox.vue';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type {
    MedicationNameRow,
    MedicationRow,
    MedicationUnit,
} from '@/types/medications';
import { todayYmd } from '@/utils/dayGroups';

const props = defineProps<{
    /** Задан — режим правки этой записи; не задан — создание. */
    row?: MedicationRow;
    /** Справочник названий пользователя. */
    names: MedicationNameRow[];
}>();

// Управляемый (v-model:open из меню строки) либо самодостаточный (слот trigger).
const open = defineModel<boolean>('open', { default: false });

const page = usePage();

const UNIT_OPTIONS: { value: MedicationUnit; label: string }[] = [
    { value: 'mg', label: 'мг' },
    { value: 'ml', label: 'мл' },
];

const formDefinition = computed(() =>
    props.row
        ? MedicationController.update.form(props.row.id)
        : MedicationController.store.form(),
);

// novalidate на форме: пустое имя или «1.234» в дозировке проверяет сервер,
// и сообщение показывается под полем (InputError), а не нативной подсказкой.

// Содержимое диалога монтируется при каждом открытии, поэтому «сегодня»
// (в поясе профиля) берётся на момент открытия.
const defaults = computed(() => ({
    dosage: props.row?.dosage ?? '',
    unit: props.row?.unit ?? 'mg',
    startDate: props.row?.start_date ?? todayYmd(page.props.auth.user.timezone),
    endDate: props.row?.end_date ?? '',
}));
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
                        {{
                            props.row
                                ? 'Изменить медикамент'
                                : 'Новый медикамент'
                        }}
                    </DialogTitle>
                    <DialogDescription>
                        Дата окончания необязательна — без неё приём считается
                        текущим.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label
                        for="medication-name"
                        class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                        >Название</Label
                    >
                    <MedicationNameCombobox
                        id="medication-name"
                        :options="names"
                        :initial-id="row?.medication_name_id ?? null"
                        :initial-name="row?.name ?? ''"
                        :invalid="!!(errors.medication_name_id || errors.name)"
                    />
                    <InputError
                        :message="errors.medication_name_id ?? errors.name"
                    />
                </div>

                <div class="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                    <div class="grid gap-2">
                        <Label
                            for="medication-dosage"
                            class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                            >Дозировка</Label
                        >
                        <Input
                            id="medication-dosage"
                            name="dosage"
                            type="number"
                            step="any"
                            min="0.00001"
                            inputmode="decimal"
                            :default-value="defaults.dosage"
                            required
                        />
                    </div>

                    <div class="grid gap-2">
                        <Label
                            for="medication-unit"
                            class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                            >Единица</Label
                        >
                        <Select name="unit" :default-value="defaults.unit">
                            <SelectTrigger id="medication-unit" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="option in UNIT_OPTIONS"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <InputError
                    v-if="errors.dosage || errors.unit"
                    :message="errors.dosage ?? errors.unit"
                />

                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <Label
                            for="medication-start-date"
                            class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                            >Начало</Label
                        >
                        <Input
                            id="medication-start-date"
                            name="start_date"
                            type="date"
                            :default-value="defaults.startDate"
                            required
                        />
                        <InputError :message="errors.start_date" />
                    </div>

                    <div class="grid gap-2">
                        <Label
                            for="medication-end-date"
                            class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                            >Окончание</Label
                        >
                        <Input
                            id="medication-end-date"
                            name="end_date"
                            type="date"
                            :default-value="defaults.endDate"
                        />
                        <InputError :message="errors.end_date" />
                    </div>
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
