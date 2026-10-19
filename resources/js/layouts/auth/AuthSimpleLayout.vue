<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppLogo from '@/components/AppLogo.vue';
import { APP_DOWNLOAD_URL, useAppDownload } from '@/composables/useAppDownload';
import { home } from '@/routes';

defineProps<{
    title?: string;
    description?: string;
}>();

const { appVersion } = useAppDownload();
</script>

<template>
    <div
        class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-8 md:p-10"
    >
        <div class="w-full max-w-sm">
            <div class="flex flex-col gap-6">
                <div class="flex flex-col items-center gap-4">
                    <Link
                        :href="home()"
                        class="flex items-center gap-2.5 text-[17px] font-extrabold"
                    >
                        <AppLogo />
                        График приступов
                    </Link>
                    <div class="space-y-2 text-center">
                        <h1 class="text-[26px] leading-tight font-extrabold">
                            {{ title }}
                        </h1>
                        <p class="text-sm text-muted-foreground">
                            {{ description }}
                        </p>
                    </div>
                </div>
                <div class="rounded-2xl border border-border bg-card p-6">
                    <slot />
                </div>
                <a
                    v-if="appVersion"
                    :href="APP_DOWNLOAD_URL"
                    class="text-center text-sm text-muted-foreground hover:text-foreground"
                >
                    Скачать приложение для Android (v{{ appVersion }})
                </a>
            </div>
        </div>
    </div>
</template>
