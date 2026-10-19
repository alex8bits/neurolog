<script setup lang="ts">
import { Form, Head } from '@inertiajs/vue3';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import Heading from '@/components/Heading.vue';
import InputError from '@/components/InputError.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/security';

defineProps<{
    passwordRules: string;
}>();

defineOptions({
    layout: {
        breadcrumbs: [
            {
                title: 'Настройки безопасности',
                href: edit(),
            },
        ],
    },
});
</script>

<template>
    <Head title="Настройки безопасности" />

    <h1 class="sr-only">Настройки безопасности</h1>

    <div class="space-y-6">
        <Heading
            variant="small"
            title="Смена пароля"
            description="Используйте длинный случайный пароль, чтобы защитить аккаунт"
        />

        <Form
            v-bind="SecurityController.update.form()"
            :options="{
                preserveScroll: true,
            }"
            reset-on-success
            :reset-on-error="[
                'password',
                'password_confirmation',
                'current_password',
            ]"
            class="space-y-6"
            v-slot="{ errors, processing }"
        >
            <div class="grid gap-2">
                <Label for="current_password">Текущий пароль</Label>
                <PasswordInput
                    id="current_password"
                    name="current_password"
                    autocomplete="current-password"
                    placeholder="Текущий пароль"
                />
                <InputError :message="errors.current_password" />
            </div>

            <div class="grid gap-2">
                <Label for="password">Новый пароль</Label>
                <PasswordInput
                    id="password"
                    name="password"
                    autocomplete="new-password"
                    placeholder="Новый пароль"
                    :passwordrules="passwordRules"
                />
                <InputError :message="errors.password" />
            </div>

            <div class="grid gap-2">
                <Label for="password_confirmation">Подтверждение пароля</Label>
                <PasswordInput
                    id="password_confirmation"
                    name="password_confirmation"
                    autocomplete="new-password"
                    placeholder="Повторите пароль"
                    :passwordrules="passwordRules"
                />
                <InputError :message="errors.password_confirmation" />
            </div>

            <div class="flex items-center gap-4">
                <Button
                    size="lg"
                    :disabled="processing"
                    data-test="update-password-button"
                >
                    Сохранить
                </Button>
            </div>
        </Form>
    </div>
</template>
