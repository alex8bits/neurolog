<script setup lang="ts">
import { Form, Head, usePage } from '@inertiajs/vue3';
import { Link } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/DeleteUser.vue';
import Heading from '@/components/Heading.vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';

defineProps<{
    timezones: { region: string; zones: string[] }[];
}>();

defineOptions({
    layout: {
        breadcrumbs: [
            {
                title: 'Настройки профиля',
                href: edit(),
            },
        ],
    },
});

const page = usePage();
const user = computed(() => page.props.auth.user);
const timezone = ref<string>(user.value.timezone);
</script>

<template>
    <Head title="Настройки профиля" />

    <h1 class="sr-only">Настройки профиля</h1>

    <div class="flex flex-col space-y-6">
        <Heading
            variant="small"
            title="Профиль"
            description="Обновите имя и адрес email"
        />

        <Form
            v-bind="ProfileController.update.form()"
            class="space-y-6"
            v-slot="{ errors, processing }"
        >
            <div class="grid gap-2">
                <Label for="name">Имя</Label>
                <Input
                    id="name"
                    name="name"
                    :default-value="user.name"
                    required
                    autocomplete="name"
                    placeholder="Полное имя"
                />
                <InputError class="mt-2" :message="errors.name" />
            </div>

            <div class="grid gap-2">
                <Label for="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    name="email"
                    :default-value="user.email"
                    required
                    autocomplete="username"
                    placeholder="Email"
                />
                <InputError class="mt-2" :message="errors.email" />
            </div>

            <div class="grid gap-2">
                <Label for="timezone">Часовой пояс</Label>
                <input type="hidden" name="timezone" :value="timezone" />
                <Select v-model="timezone">
                    <SelectTrigger id="timezone" class="w-full">
                        <SelectValue placeholder="Выберите часовой пояс" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup
                            v-for="group in timezones"
                            :key="group.region"
                        >
                            <SelectLabel>{{ group.region }}</SelectLabel>
                            <SelectItem
                                v-for="zone in group.zones"
                                :key="zone"
                                :value="zone"
                            >
                                {{ zone }}
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <p class="text-sm text-muted-foreground">
                    Время приступов показывается и выгружается в этом поясе.
                    Смена пояса меняет отображение уже сохранённых записей.
                </p>
                <InputError class="mt-2" :message="errors.timezone" />
            </div>

            <div v-if="page.props.mustVerifyEmail && !user.email_verified_at">
                <p class="-mt-4 text-sm text-muted-foreground">
                    Ваш email не подтверждён.
                    <Link
                        :href="send()"
                        as="button"
                        class="text-foreground underline decoration-border underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current!"
                    >
                        Нажмите здесь, чтобы отправить письмо повторно.
                    </Link>
                </p>

                <div
                    v-if="page.props.status === 'verification-link-sent'"
                    class="mt-2 text-sm font-medium text-primary"
                >
                    Новая ссылка для подтверждения отправлена на ваш email.
                </div>
            </div>

            <div class="flex items-center gap-4">
                <Button
                    size="lg"
                    :disabled="processing"
                    data-test="update-profile-button"
                    >Сохранить</Button
                >
            </div>
        </Form>
    </div>

    <DeleteUser />
</template>
