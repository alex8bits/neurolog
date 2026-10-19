<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import Heading from '@/components/Heading.vue';
import { useCurrentUrl } from '@/composables/useCurrentUrl';
import { toUrl } from '@/lib/utils';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { NavItem } from '@/types';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Профиль',
        href: editProfile(),
    },
    {
        title: 'Безопасность',
        href: editSecurity(),
    },
];

const { isCurrentOrParentUrl } = useCurrentUrl();
</script>

<template>
    <div class="px-4 py-6">
        <Heading
            title="Настройки"
            description="Управление профилем и настройками аккаунта"
        />

        <div class="flex flex-col lg:flex-row lg:gap-12">
            <aside class="w-full max-w-xl lg:w-48">
                <!-- Мобильная ширина: горизонтальные табы; от lg — вертикальное меню. -->
                <nav
                    class="flex flex-row gap-6 border-b border-border lg:flex-col lg:gap-1 lg:border-b-0"
                    aria-label="Настройки"
                >
                    <Link
                        v-for="item in sidebarNavItems"
                        :key="toUrl(item.href)"
                        :href="item.href"
                        class="-mb-px border-b-2 py-2 text-[15px] font-semibold transition-colors lg:mb-0 lg:border-b-0 lg:border-l-2 lg:py-1.5 lg:pl-3"
                        :class="
                            isCurrentOrParentUrl(item.href)
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        "
                    >
                        {{ item.title }}
                    </Link>
                </nav>
            </aside>

            <div class="mt-6 flex-1 md:max-w-2xl lg:mt-0">
                <section class="max-w-xl space-y-12">
                    <slot />
                </section>
            </div>
        </div>
    </div>
</template>
