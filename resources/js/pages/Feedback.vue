<script setup lang="ts">
import { Head, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import FeedbackController from '@/actions/App/Http/Controllers/FeedbackController';
import Heading from '@/components/Heading.vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const page = usePage();

// Префилл из профиля: поля редактируемые, при отправке берётся то, что
// в них сейчас (DOM читает Inertia Form), а не значение профиля.
const user = computed(() => page.props.auth.user);

// Локальный флаг анонимности: hidden-input несёт '1'/'0' в форму (правило
// boolean), а сам чекбокс — shadcn-компонент без нативного name.
const anonymous = ref(false);
const message = ref('');

function onAnonymousChange(value: boolean | 'indeterminate'): void {
    anonymous.value = value === true;
}
</script>

<template>
    <Head title="Обратная связь" />

    <h1 class="sr-only">Обратная связь</h1>

    <div class="flex flex-col space-y-6">
        <Heading
            variant="small"
            title="Обратная связь"
            description="Вопрос, предложение или проблема — письмо придёт разработчику проекта."
        />

        <Form
            v-bind="FeedbackController.store.form()"
            :options="{ preserveScroll: true }"
            class="space-y-6"
            v-slot="{ errors, processing }"
            @success="message = ''"
        >
            <!-- Disabled-поля не попадают в FormData — при анонимном
                 обращении имя/почта не уходят на сервер вовсе. -->
            <div class="grid gap-2">
                <Label for="name">Имя</Label>
                <Input
                    id="name"
                    name="name"
                    :value="user.name"
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
                    :value="user.email"
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
