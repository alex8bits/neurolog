<script setup lang="ts">
import AppLogoIcon from '@/components/AppLogoIcon.vue';
</script>

<template>
    <!-- Фирменный значок: бирюзовый скруглённый квадрат с графиком.
         Размер задаётся классом носителя (по умолчанию 28 px). -->
    <span
        class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
    >
        <AppLogoIcon class="size-full" />
    </span>
</template>
