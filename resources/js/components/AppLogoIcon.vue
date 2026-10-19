<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

defineOptions({
    inheritAttrs: false,
});

type Props = {
    className?: HTMLAttributes['class'];
};

defineProps<Props>();
</script>

<template>
    <!-- Глиф приложения: линейный график (спарклайн) с точкой на последнем значении.
         Рисуется currentColor — носитель задаёт цвет и фон-плитку. -->
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        :class="className"
        v-bind="$attrs"
    >
        <polyline
            points="4,16.5 8.5,11.5 12,13.5 16,7 19.5,10"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <circle cx="19.5" cy="10" r="2" fill="currentColor" />
    </svg>
</template>
