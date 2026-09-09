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
    <!-- Фирменный глиф приложения: EEG-линия с резким спайком и маркером
         над пиком (та же форма, что на иконках мобильного клиента).
         Штрихованный — наследует currentColor носителя. -->
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        :class="className"
        v-bind="$attrs"
    >
        <polyline
            points="3,16 6.4,16 8,13 9.6,16 12.2,16 14.9,8.2 17.6,16 19.7,16 21.5,13.4"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <circle cx="14.9" cy="4.4" r="1.6" fill="currentColor" />
    </svg>
</template>
