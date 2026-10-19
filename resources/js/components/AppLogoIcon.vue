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
    <!-- Глиф приложения: три горизонтальные линии (как .logo i в макете).
         Рисуется currentColor — носитель задаёт цвет и фон-плитку. -->
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        :class="className"
        v-bind="$attrs"
    >
        <rect x="6" y="6.5" width="12" height="2" rx="1" fill="currentColor" />
        <rect x="6" y="11" width="12" height="2" rx="1" fill="currentColor" />
        <rect x="6" y="15.5" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
</template>
