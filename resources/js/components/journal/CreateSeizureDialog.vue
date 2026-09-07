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

// Пропов нет — диалог самодостаточный.
const open = ref(false);
</script>

<template>
    <Dialog v-model:open="open">
        <DialogTrigger as-child>
            <slot name="trigger" />
        </DialogTrigger>
        <DialogContent>
            <Form
                v-bind="SeizureController.store.form()"
                :options="{ preserveScroll: true }"
                @success="open = false"
                class="space-y-6"
                v-slot="{ errors, processing }"
            >
                <DialogHeader class="space-y-3">
                    <DialogTitle>Новая запись</DialogTitle>
                    <DialogDescription>
                        Укажите дату и время в вашем часовом поясе. Если
                        оставить пустым — сохранится момент отправки.
                        Комментарий необязателен.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label for="occurred_at">Дата и время</Label>
                    <Input
                        id="occurred_at"
                        type="datetime-local"
                        name="occurred_at"
                    />
                    <InputError :message="errors.occurred_at" />
                </div>

                <div class="grid gap-2">
                    <Label for="comment">Комментарий</Label>
                    <Input id="comment" name="comment" maxlength="2000" />
                    <InputError :message="errors.comment" />
                </div>

                <DialogFooter class="gap-2">
                    <DialogClose as-child>
                        <Button variant="secondary" :disabled="processing">
                            Отмена
                        </Button>
                    </DialogClose>

                    <Button type="submit" :disabled="processing">
                        Добавить
                    </Button>
                </DialogFooter>
            </Form>
        </DialogContent>
    </Dialog>
</template>
