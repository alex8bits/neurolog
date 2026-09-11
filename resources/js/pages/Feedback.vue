<script setup lang="ts">
import { Form, Head, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import FeedbackController from '@/actions/App/Http/Controllers/FeedbackController';
import Heading from '@/components/Heading.vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const page = usePage();

// Префилл из профиля в локальные refs: форма контролируемая (v-model),
// отправляется ровно то, что в полях.
const user = computed(() => page.props.auth.user);
const name = ref(user.value.name);
const email = ref(user.value.email);

// Локальный флаг анонимности: hidden-input несёт '1'/'0' в форму (правило
// boolean), а сам чекбокс — shadcn-компонент без нативного name.
const anonymous = ref(false);
const message = ref('');

// Инлайн-уведомление об отправке: не зависит от flash-события тоста,
// гаснет при вводе нового текста.
const justSent = ref(false);

function onSent(): void {
    message.value = '';
    justSent.value = true;
}

function onAnonymousChange(value: boolean | 'indeterminate'): void {
    anonymous.value = value === true;
}
</script>

<template>
    <Head title="Обратная связь" />

    <h1 class="sr-only">Обратная связь</h1>

    <!-- Контейнер как у журнала (p-4/flex-1): боковые отступы от
         сайдбара и заполнение высоты, а не прилипший к краю контент. -->
    <div class="flex h-full flex-1 flex-col gap-6 p-4">
        <Heading
            variant="small"
            title="Обратная связь"
            description="Вопрос, предложение или проблема — письмо придёт разработчику проекта."
        />

        <p
            v-if="justSent"
            role="status"
            class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
            Обращение отправлено. Спасибо!
        </p>

        <Form
            v-bind="FeedbackController.store.form()"
            :options="{ preserveScroll: true }"
            class="space-y-6"
            v-slot="{ errors, processing }"
            @success="onSent"
        >
            <div class="grid gap-2">
                <Label for="name">Имя</Label>
                <Input
                    id="name"
                    name="name"
                    v-model="name"
                    :disabled="anonymous"
                    maxlength="255"
                />
                <InputError :message="errors.name" />
            </div>

            <div class="grid gap-2">
                <Label for="email">Почта</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    v-model="email"
                    :disabled="anonymous"
                    maxlength="255"
                />
                <InputError :message="errors.email" />
            </div>

            <div class="flex items-center gap-2">
                <Checkbox
                    id="anonymous"
                    :model-value="anonymous"
                    @update:model-value="onAnonymousChange"
                />
                <input
                    type="hidden"
                    name="anonymous"
                    :value="anonymous ? '1' : '0'"
                />
                <Label for="anonymous">Анонимное обращение</Label>
            </div>
            <p class="text-sm text-muted-foreground">
                С флагом отправляется только текст обращения — без имени и
                почты.
            </p>

            <div class="grid gap-2">
                <Label for="message">Текст обращения</Label>
                <textarea
                    id="message"
                    name="message"
                    v-model="message"
                    @input="justSent = false"
                    rows="6"
                    maxlength="5000"
                    required
                    class="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <InputError :message="errors.message" />
            </div>

            <Button type="submit" :disabled="processing">
                {{ processing ? 'Отправляем…' : 'Отправить' }}
            </Button>
        </Form>
    </div>
</template>
