<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3';
import { Menu, Smartphone } from '@lucide/vue';
import { computed } from 'vue';
import AppLogo from '@/components/AppLogo.vue';
import Breadcrumbs from '@/components/Breadcrumbs.vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import UserMenuContent from '@/components/UserMenuContent.vue';
import { APP_DOWNLOAD_URL, useAppDownload } from '@/composables/useAppDownload';
import { useCurrentUrl } from '@/composables/useCurrentUrl';
import { getInitials } from '@/composables/useInitials';
import { dashboard } from '@/routes';
import { edit as feedbackEdit } from '@/routes/feedback';
import { index as medicationsIndex } from '@/routes/medications';
import type { BreadcrumbItem, NavItem } from '@/types';

type Props = {
    breadcrumbs?: BreadcrumbItem[];
};

const props = withDefaults(defineProps<Props>(), {
    breadcrumbs: () => [],
});

const page = usePage();
const auth = computed(() => page.props.auth);
const appName = computed(() => page.props.name);
const { isCurrentUrl } = useCurrentUrl();
const { appVersion } = useAppDownload();

const mainNavItems: NavItem[] = [
    { title: 'Журнал', href: dashboard() },
    { title: 'Медикаменты', href: medicationsIndex() },
    { title: 'Обратная связь', href: feedbackEdit().url },
];
</script>

<template>
    <div>
        <div class="border-b border-border bg-card">
            <div
                class="mx-auto flex h-14 w-full max-w-[1240px] items-center gap-4 px-4 md:gap-7 md:px-8"
            >
                <!-- Бургер: ссылки навигации на узкой ширине -->
                <div class="md:hidden">
                    <Sheet>
                        <SheetTrigger :as-child="true">
                            <Button
                                variant="ghost"
                                size="icon"
                                class="-ml-2 size-9"
                                aria-label="Меню навигации"
                            >
                                <Menu class="size-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" class="w-[280px] p-6">
                            <SheetTitle class="sr-only"
                                >Меню навигации</SheetTitle
                            >
                            <SheetHeader class="text-left">
                                <span class="text-base font-extrabold">{{
                                    appName
                                }}</span>
                            </SheetHeader>
                            <nav class="-mx-3 mt-4 space-y-1">
                                <Link
                                    v-for="item in mainNavItems"
                                    :key="item.title"
                                    :href="item.href"
                                    class="flex items-center rounded-lg px-3 py-2 text-sm font-semibold hover:bg-accent"
                                    :class="
                                        isCurrentUrl(item.href)
                                            ? 'text-foreground'
                                            : 'text-muted-foreground'
                                    "
                                >
                                    {{ item.title }}
                                </Link>
                                <a
                                    v-if="appVersion"
                                    :href="APP_DOWNLOAD_URL"
                                    :aria-label="`Скачать приложение (v${appVersion})`"
                                    class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
                                >
                                    <Smartphone class="size-4" />
                                    Скачать приложение
                                    <span class="text-xs font-normal"
                                        >v{{ appVersion }}</span
                                    >
                                </a>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>

                <Link
                    :href="dashboard()"
                    class="flex items-center gap-2.5 text-[17px] font-extrabold"
                >
                    <AppLogo />
                    <span class="hidden sm:inline">{{ appName }}</span>
                </Link>

                <nav class="hidden h-full items-stretch gap-7 md:flex">
                    <Link
                        v-for="item in mainNavItems"
                        :key="item.title"
                        :href="item.href"
                        class="flex items-center border-t-2 border-b-2 border-t-transparent text-[15px] font-semibold transition-colors"
                        :class="
                            isCurrentUrl(item.href)
                                ? 'border-b-primary text-foreground'
                                : 'border-b-transparent text-muted-foreground hover:text-foreground'
                        "
                    >
                        {{ item.title }}
                    </Link>
                    <a
                        v-if="appVersion"
                        :href="APP_DOWNLOAD_URL"
                        :aria-label="`Скачать приложение (v${appVersion})`"
                        class="flex items-center gap-1.5 border-t-2 border-b-2 border-t-transparent border-b-transparent text-[15px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <Smartphone class="size-4" />
                        Скачать приложение
                        <span class="text-xs font-normal"
                            >v{{ appVersion }}</span
                        >
                    </a>
                </nav>

                <div class="ml-auto flex items-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger :as-child="true">
                            <Button
                                variant="ghost"
                                size="icon"
                                class="size-10 w-auto rounded-full p-1"
                                aria-label="Меню пользователя"
                            >
                                <Avatar
                                    class="size-8 overflow-hidden rounded-full"
                                >
                                    <AvatarImage
                                        v-if="auth.user.avatar"
                                        :src="auth.user.avatar"
                                        :alt="auth.user.name"
                                    />
                                    <AvatarFallback
                                        class="rounded-full bg-primary-soft font-extrabold text-primary"
                                    >
                                        {{ getInitials(auth.user?.name) }}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-64">
                            <UserMenuContent :user="auth.user" />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>

        <div
            v-if="props.breadcrumbs.length > 1"
            class="flex w-full border-b border-border"
        >
            <div
                class="mx-auto flex h-12 w-full max-w-[1240px] items-center justify-start px-4 text-muted-foreground md:px-8"
            >
                <Breadcrumbs :breadcrumbs="breadcrumbs" />
            </div>
        </div>
    </div>
</template>
