<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { LayoutGrid, Heart, Smartphone } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import AppLogo from '@/components/AppLogo.vue';
import NavMain from '@/components/NavMain.vue';
import NavUser from '@/components/NavUser.vue';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Журнал приступов',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

// Публикуется скриптом mobile/scripts/publish-apk.sh в public/downloads/.
// Имя файла фиксировано, поэтому ссылка стабильна между релизами; мета
// пишется рядом. Нет меты — APK не публиковали, пункта меню не показываем.
const APP_DOWNLOAD_URL = '/downloads/seizure.apk';
const appVersion = ref<string | null>(null);

// Сборы добровольных пожертвований (Т-Банк и Сбер) — внешние страницы,
// открываются в новой вкладке. Ссылка Сбера — короткий адрес его
// мессенджера, счёт в банке иметь не обязательно.
const DONATE_URLS = [
    { label: 'Т-Банк', url: 'https://www.tbank.ru/cf/41k9RdG5ibo' },
    {
        label: 'Сбербанк',
        url: 'https://messenger.sbrf.ru/sl/4YhMIBtzuatnweYM0',
    },
];

onMounted(() => {
    fetch('/downloads/app-release.json', {
        headers: { Accept: 'application/json' },
    })
        .then(async (response) => {
            if (!response.ok) {
                return;
            }

            const meta: { version?: unknown } = await response.json();

            if (typeof meta.version === 'string' && meta.version.length > 0) {
                appVersion.value = meta.version;
            }
        })
        .catch(() => {
            // Сеть недоступна или мета не опубликована — просто прячем пункт.
        });
});
</script>

<template>
    <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg" as-child>
                        <Link :href="dashboard()">
                            <AppLogo />
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
            <NavMain :items="mainNavItems" />

            <SidebarGroup v-if="appVersion" class="px-2 py-0">
                <SidebarGroupLabel>Приложение</SidebarGroupLabel>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            as-child
                            :tooltip="`Скачать приложение (v${appVersion})`"
                        >
                            <!-- Обычный <a>, не Link: скачивание файла не должно
                                 перехватываться Inertia-роутером. -->
                            <a :href="APP_DOWNLOAD_URL" download>
                                <Smartphone />
                                <span>Скачать приложение</span>
                            </a>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>v{{ appVersion }}</SidebarMenuBadge>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup class="px-2 py-0">
                <SidebarGroupLabel>Проект</SidebarGroupLabel>
                <SidebarMenu>
                    <!-- Обычные <a>, не Link: внешние страницы сборов
                         открываются в новой вкладке. -->
                    <SidebarMenuItem
                        v-for="donate in DONATE_URLS"
                        :key="donate.url"
                    >
                        <SidebarMenuButton
                            as-child
                            :tooltip="`Поддержать проект — ${donate.label}`"
                        >
                            <a
                                :href="donate.url"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Heart />
                                <span>Поддержать ({{ donate.label }})</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
            <NavUser />
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>
