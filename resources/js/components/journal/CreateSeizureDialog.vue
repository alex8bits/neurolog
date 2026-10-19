<script setup lang="ts">
import { Form, usePage } from '@inertiajs/vue3';
import { nextTick, ref, watch } from 'vue';
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
const page = usePage();

const occurredAt = ref('');
const showComment = ref(false);
const commentInput = ref<InstanceType<typeof Input> | null>(null);

function revealComment(): void {
    showComment.value = true;
    // Поле появляется после рендера: autofocus на динамическом элементе не срабатывает.
    nextTick(() => {
        const el = commentInput.value?.$el as HTMLElement | undefined;
        el?.focus();
    });
}

// «Сейчас» в поясе профиля в формате datetime-local (YYYY-MM-DDTHH:mm).
function nowInProfileZone(): string {
    try {
        return new Intl.DateTimeFormat('sv-SE', {
            timeZone: page.props.auth.user.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        })
            .format(new Date())
            .replace(' ', 'T');
    } catch {
        return '';
    }
}

watch(open, (isOpen) => {
    if (isOpen) {
        occurredAt.value = nowInProfileZone();
        showComment.value = false;
    }
});
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
                class="space-y-5"
                v-slot="{ errors, processing }"
            >
                <DialogHeader class="space-y-2">
                    <DialogTitle class="text-xl font-extrabold">
                        Новая запись
                    </DialogTitle>
                    <DialogDescription>
                        Время указывается в вашем часовом поясе. Если очистить
                        поле — сохранится момент отправки.
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-2">
                    <Label
                        for="occurred_at"
                        class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                    >
                        Время
                    </Label>
                    <Input
                        id="occurred_at"
                        v-model="occurredAt"
                        type="datetime-local"
                        name="occurred_at"
                    />
                    <InputError :message="errors.occurred_at" />
                </div>

                <button
                    v-if="!showComment && !errors.comment"
                    type="button"
                    class="text-sm font-bold text-primary hover:underline"
                    @click="revealComment"
                >
                    + комментарий
                </button>
                <div v-else class="grid gap-2">
                    <Label
                        for="comment"
                        class="text-xs font-bold tracking-wide text-muted-foreground uppercase"
                    >
                        Комментарий
                    </Label>
                    <Input
                        id="comment"
                        name="comment"
                        ref="commentInput"
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
