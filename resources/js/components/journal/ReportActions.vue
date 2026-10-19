<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import SeizureController from '@/actions/App/Http/Controllers/SeizureController';
import EmailDoctorDialog from '@/components/journal/EmailDoctorDialog.vue';
import { Button } from '@/components/ui/button';
import type { JournalFilters } from '@/types/journal';

const props = defineProps<{ filters: JournalFilters }>();

const doctorOpen = ref(false);
const emailing = ref(false);

const periodQuery = computed(() => {
    const q: Record<string, string> = {};

    if (props.filters.from) {
        q.from = props.filters.from;
    }

    if (props.filters.to) {
        q.to = props.filters.to;
    }

    // Вид «Всё время»: границы пусты, без флага сервер подставил бы дефолт
    // «неделя» — а экспортировать/печатать нужно то, что на экране.
    if (props.filters.all) {
        q.all = '1';
    }

    return q;
});

const downloadHref = computed(
    () => SeizureController.download({ query: periodQuery.value }).url,
);
const printHref = computed(
    () => SeizureController.print({ query: periodQuery.value }).url,
);

function emailSelf(): void {
    if (emailing.value) {
        return;
    }

    emailing.value = true;
    router.post(
        SeizureController.emailSelf({ query: periodQuery.value }).url,
        {},
        {
            preserveScroll: true,
            onFinish: () => {
                emailing.value = false;
            },
        },
    );
}

const outlineClass = 'h-auto px-4 py-2.5';
</script>

<template>
    <div>
        <small class="text-[13px] font-semibold text-muted-foreground">
            ОТЧЁТ ЗА ЭТОТ ПЕРИОД
        </small>

        <div class="mt-2.5 flex flex-col gap-2">
            <Button class="h-auto px-4 py-2.5" @click="doctorOpen = true">
                Отправить доктору
            </Button>

            <!-- Обычный <a>, не Inertia Link: бинарный ответ DOCX нельзя
                 получить через XHR-визит — только настоящей навигацией,
                 иначе файл не скачивается. -->
            <Button variant="outline" :class="outlineClass" as-child>
                <a :href="downloadHref">Сохранить DOCX</a>
            </Button>

            <Button variant="outline" :class="outlineClass" as-child>
                <Link :href="printHref" target="_blank">Печать</Link>
            </Button>

            <Button
                variant="outline"
                :class="outlineClass"
                :disabled="emailing"
                @click="emailSelf"
            >
                Отправить себе
            </Button>
        </div>

        <EmailDoctorDialog v-model:open="doctorOpen" :filters="filters" />
    </div>
</template>
