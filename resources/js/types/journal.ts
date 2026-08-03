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
};

// Laravel's `LengthAwarePaginator` JSON shape that Inertia passes to the page.
// Only the fields the client actually reads are typed.
export type Paginated<T> = {
    data: T[];
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    meta: {
        current_page: number;
        from: number | null;
        last_page: number;
        path: string;
        per_page: number;
        to: number | null;
        total: number;
    };
};
