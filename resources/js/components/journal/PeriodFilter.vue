<script setup lang="ts">
import { Link, router, usePage } from '@inertiajs/vue3';
import { ref } from 'vue';
import InputError from '@/components/InputError.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboard } from '@/routes';
import type { JournalFilters } from '@/types/journal';

const props = defineProps<{ filters: JournalFilters }>();

const page = usePage();
const toError = ref<string | undefined>(
    (page.props.errors as Record<string, string> | undefined)?.to,
);

const from = ref<string>(props.filters.from ?? '');
const to = ref<string>(props.filters.to ?? '');

function apply(): void {
    const query: { from?: string; to?: string } = {};

    if (from.value) {
        query.from = from.value;
    }

    if (to.value) {
        query.to = to.value;
    }

    router.get(dashboard().url, query, {
        preserveState: true,
        replace: true,
        onError: (errors) => {
            toError.value = (errors as Record<string, string>).to;
        },
        onSuccess: () => {
            toError.value = undefined;
        },
    });
}
</script>

<template>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="apply">
        <div class="grid gap-1.5">
            <Label for="from">Дата начала</Label>
            <Input id="from" v-model="from" type="date" name="from" />
        </div>

        <div class="grid gap-1.5">
            <Label for="to">Дата конца</Label>
            <Input id="to" v-model="to" type="date" name="to" />
            <InputError :message="toError" />
        </div>

        <Button type="submit">Показать</Button>

        <Button variant="outline" as-child>
            <Link :href="dashboard()">Сбросить фильтр</Link>
        </Button>
    </form>
</template>
