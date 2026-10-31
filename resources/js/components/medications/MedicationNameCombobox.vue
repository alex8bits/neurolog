<script setup lang="ts">
import { ChevronDown, Plus } from '@lucide/vue';
import {
    ComboboxAnchor,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxPortal,
    ComboboxRoot,
    ComboboxTrigger,
    ComboboxViewport,
} from 'reka-ui';
import { computed, ref } from 'vue';
import type { MedicationNameRow } from '@/types/medications';

const props = defineProps<{
    options: MedicationNameRow[];
    initialId?: number | null;
    initialName?: string;
    invalid?: boolean;
    id?: string;
}>();

const ADD_VALUE = '__add__';

const selectedId = ref<number | null>(props.initialId ?? null);
const query = ref<string>(props.initialName ?? '');

const normalized = (value: string): string =>
    value.trim().toLocaleLowerCase('ru');

const filtered = computed(() => {
    const needle = normalized(query.value);

    return props.options.filter((o) =>
        o.name.toLocaleLowerCase('ru').includes(needle),
    );
});

const trimmed = computed(() => query.value.trim());

const canAdd = computed(
    () =>
        trimmed.value !== '' &&
        !props.options.some(
            (o) => normalized(o.name) === normalized(query.value),
        ),
);

function onSelect(value: unknown): void {
    if (value === ADD_VALUE || value === null || value === undefined) {
        selectedId.value = null;

        return;
    }

    const option = props.options.find((o) => o.id === value);

    if (option) {
        selectedId.value = option.id;
        query.value = option.name;
    }
}

// Любая правка текста, расходящаяся с названием выбранной позиции, снимает выбор:
// тогда уходит `name`, а сервер сам привяжет его к существующей позиции.
function onInput(value: string | undefined): void {
    query.value = value ?? '';

    const selected = props.options.find((o) => o.id === selectedId.value);

    if (selected && selected.name !== query.value) {
        selectedId.value = null;
    }
}
</script>

<template>
    <ComboboxRoot
        :model-value="selectedId"
        ignore-filter
        :reset-search-term-on-blur="false"
        :reset-search-term-on-select="false"
        @update:model-value="onSelect"
    >
        <input
            v-if="selectedId !== null"
            type="hidden"
            name="medication_name_id"
            :value="selectedId"
        />
        <input v-else type="hidden" name="name" :value="trimmed" />

        <ComboboxAnchor class="relative block w-full">
            <ComboboxInput
                :id="id"
                :model-value="query"
                maxlength="255"
                placeholder="Начните вводить название"
                :aria-invalid="invalid ? 'true' : undefined"
                class="h-11 w-full min-w-0 rounded-xl border-[1.5px] border-input bg-background px-3 py-1 pr-9 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary-soft aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm"
                @update:model-value="onInput"
            />
            <ComboboxTrigger
                class="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground"
                aria-label="Открыть список"
            >
                <ChevronDown class="size-4" />
            </ComboboxTrigger>
        </ComboboxAnchor>

        <ComboboxPortal>
            <ComboboxContent
                position="popper"
                :side-offset="4"
                class="relative z-50 max-h-64 w-(--reka-combobox-trigger-width) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
            >
                <ComboboxViewport class="p-1">
                    <ComboboxEmpty
                        v-if="filtered.length === 0 && !canAdd"
                        class="px-2 py-1.5 text-sm text-muted-foreground"
                    >
                        Справочник пуст — введите название
                    </ComboboxEmpty>

                    <ComboboxItem
                        v-for="option in filtered"
                        :key="option.id"
                        :value="option.id"
                        class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                    >
                        {{ option.name }}
                    </ComboboxItem>

                    <ComboboxItem
                        v-if="canAdd"
                        :value="ADD_VALUE"
                        class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                    >
                        <Plus class="size-4 text-muted-foreground" />
                        Добавить «{{ trimmed }}»
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxContent>
        </ComboboxPortal>
    </ComboboxRoot>
</template>
