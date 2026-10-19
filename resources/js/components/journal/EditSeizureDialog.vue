<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
import { ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import SeizureController from '@/actions/App/Http/Controllers/SeizureController';
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
import type { SeizureRow } from '@/types/journal';

const props = defineProps<{
    row: SeizureRow;
    /** 'comment' — при открытии фокус сразу в поле комментария. */
    focus?: 'comment';
}>();

// Управляемый (v-model:open из меню строки) либо самодостаточный (слот trigger).
const open = defineModel<boolean>('open', { default: false });

const commentInput = ref<ComponentPublicInstance | null>(null);

function onOpenAutoFocus(event: Event): void {
    if (props.focus !== 'comment') {
        return;
    }

    event.preventDefault();
    (commentInput.value?.$el as HTMLInputElement | undefined)?.focus();
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogTrigger v-if="$slots.trigger" as-child>
            <slot name="trigger" />
        </DialogTrigger>
        <DialogContent @open-auto-focus="onOpenAutoFocus">
            <Form
                v-bind="SeizureController.update.form(props.row.id)"
                :options="{ preserveScroll: true }"
                @success="open = false"
                class="space-y-5"
                v-slot="{ errors, processing }"
            >
                <DialogHeader class="space-y-3">
                    <DialogTitle class="text-xl font-extrabold">
                        Запись {{ props.row.time }}
                    </DialogTitle>
                    <DialogDescription>
                        Измените дату, время и комментарий. Время указывается в
                        вашем часовом поясе.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label
                        for="occurred_at"
                        class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                        >Время</Label
                    >
                    <Input
                        id="occurred_at"
                        type="datetime-local"
                        name="occurred_at"
                        :default-value="props.row.occurred_at_local"
                        required
                    />
                    <InputError :message="errors.occurred_at" />
                </div>

                <div class="grid gap-2">
                    <Label
                        for="comment"
                        class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                        >Комментарий</Label
                    >
                    <Input
                        id="comment"
                        ref="commentInput"
                        name="comment"
                        :default-value="props.row.comment ?? ''"
                        maxlength="2000"
                    />
                    <InputError :message="errors.comment" />
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
