// Web journal: a row from the paginated list rendered in the owner's timezone.
// All values are pre-formatted by `SeizureRowResource` — the client performs
// no timezone arithmetic of its own.

export type SeizureRow = {
    id: number;
    date: string;
    time: string;
    comment: string | null;
    occurred_at_local: string;
};

export type JournalFilters = {
    from: string | null;
    to: string | null;
    // true, когда журнал открыт целиком (?all=1): действие экспорта/почты
    // должно повторить это состояние, а не подставить дефолт «неделя».
    all?: boolean;
};

// Laravel's `LengthAwarePaginator` JSON shape that Inertia passes to the page.
// `links` is a flat object with first/last/prev/next URLs; the per-page link
// chips (Previous / page numbers / Next) live under `meta.links`. Only the
// fields the client actually reads are typed.
export type Paginated<T> = {
    data: T[];
    links: {
        first: string | null;
        last: string | null;
        prev: string | null;
        next: string | null;
    };
    meta: {
        current_page: number;
        from: number | null;
        last_page: number;
        path: string;
        per_page: number;
        to: number | null;
        total: number;
        links: {
            url: string | null;
            label: string;
            active: boolean;
        }[];
    };
};
