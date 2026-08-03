<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
import { ref } from 'vue';
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

const props = defineProps<{ row: SeizureRow }>();

const open = ref(false);
</script>

<template>
    <Dialog v-model:open="open">
        <DialogTrigger as-child>
            <slot name="trigger" />
        </DialogTrigger>
        <DialogContent>
            <Form
                v-bind="SeizureController.update.form(props.row.id)"
                :options="{ preserveScroll: true }"
                @success="open = false"
                class="space-y-6"
                v-slot="{ errors, processing }"
            >
                <DialogHeader class="space-y-3">
                    <DialogTitle>Редактировать запись</DialogTitle>
                    <DialogDescription>
                        Измените дату, время и комментарий. Время указывается в
                        вашем часовом поясе.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label for="occurred_at">Дата и время</Label>
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
                    <Label for="comment">Комментарий</Label>
                    <Input
                        id="comment"
                        name="comment"
                        :default-value="props.row.comment ?? ''"
                        maxlength="2000"
                    />
                    <InputError :message="errors.comment" />
                </div>

                <DialogFooter class="gap-2">
                    <DialogClose as-child>
                        <Button variant="secondary" :disabled="processing">
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
