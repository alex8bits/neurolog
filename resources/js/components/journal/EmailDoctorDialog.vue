<script setup lang="ts">
import { Form } from '@inertiajs/vue3';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { JournalFilters } from '@/types/journal';

const props = defineProps<{
    open: boolean;
    filters: JournalFilters;
}>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();

function onOpenChange(v: boolean): void {
    emit('update:open', v);
}
</script>

<template>
    <Dialog :open="props.open" @update:open="onOpenChange">
        <DialogContent>
            <Form
                v-bind="
                    SeizureController.emailDoctor.form({
                        query: props.filters,
                    })
                "
                :options="{ preserveScroll: true }"
                @success="onOpenChange(false)"
                class="space-y-6"
                v-slot="{ errors, processing }"
            >
                <DialogHeader class="space-y-3">
                    <DialogTitle>Отправить доктору</DialogTitle>
                    <DialogDescription>
                        Журнал за выбранный период будет приложен в формате
                        DOCX. Тема и текст — необязательны: при пустых полях
                        подставятся значения по умолчанию.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label for="to">Адрес получателя</Label>
                    <Input
                        id="to"
                        name="to"
                        type="email"
                        required
                        maxlength="255"
                    />
                    <InputError :message="errors.to" />
                </div>

                <div class="grid gap-2">
                    <Label for="subject">Тема (необязательно)</Label>
                    <Input id="subject" name="subject" maxlength="255" />
                    <InputError :message="errors.subject" />
                </div>

                <div class="grid gap-2">
                    <Label for="body">Текст письма (необязательно)</Label>
                    <textarea
                        id="body"
                        name="body"
                        rows="5"
                        maxlength="5000"
                        class="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <InputError :message="errors.body" />
                </div>

                <DialogFooter class="gap-2">
                    <DialogClose as-child>
                        <Button variant="secondary" :disabled="processing">
                            Отмена
                        </Button>
                    </DialogClose>
                    <Button type="submit" :disabled="processing">
                        Отправить
                    </Button>
                </DialogFooter>
            </Form>
        </DialogContent>
    </Dialog>
</template>
