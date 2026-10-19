<script setup lang="ts">
import { router } from '@inertiajs/vue3';
import { ref } from 'vue';
import SeizureController from '@/actions/App/Http/Controllers/SeizureController';

const processing = ref(false);

// Пустая запись: сервер сам ставит «сейчас» в поясе профиля.
function record(): void {
    if (processing.value) {
        return;
    }

    processing.value = true;
    router.post(
        SeizureController.store().url,
        {},
        {
            preserveScroll: true,
            onFinish: () => {
                processing.value = false;
            },
        },
    );
}
</script>

<template>
    <button
        type="button"
        class="block min-h-16 w-full cursor-pointer rounded-2xl bg-primary px-5 py-3 text-center text-[19px] font-extrabold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        :disabled="processing"
        @click="record"
    >
        Записать приступ
        <small
            class="mt-0.5 block text-[13px] font-medium text-primary-foreground/80"
        >
            время фиксируется «сейчас»
        </small>
    </button>
</template>
