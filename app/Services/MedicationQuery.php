<?php

namespace App\Services;

use App\Concerns\ResolvesUserTimezone;
use App\Enums\MedicationStatus;
use App\Models\Medication;
use App\Models\User;
use App\Support\MedicationFilters;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicationQuery
{
    use ResolvesUserTimezone;

    /**
     * Key inside the "planned" group: the nearest start first.
     */
    private const PLANNED_ORDER = 'CASE WHEN start_date > ? THEN start_date END ASC';

    /**
     * Key inside the "active" group: the most recently started first.
     */
    private const ACTIVE_ORDER = 'CASE WHEN start_date <= ? AND (end_date IS NULL OR end_date >= ?) THEN start_date END DESC';

    /**
     * Key inside the "finished" group: the most recently finished first.
     */
    private const FINISHED_ORDER = 'CASE WHEN end_date IS NOT NULL AND end_date < ? THEN end_date END DESC';

    /**
     * Case-insensitive substring match on the folded name.
     *
     * `!` is the escape character because it reads the same in SQLite and
     * MySQL: a backslash inside a MySQL string literal (default sql_mode)
     * escapes the closing quote and breaks the statement.
     */
    private const SEARCH_WHERE = "name_search LIKE ? ESCAPE '!'";

    /**
     * Today's Y-m-d date in the owner's timezone.
     *
     * The timezone resolves as: explicit `$timezone` → the owner's profile →
     * UTC. Controllers hand the same value to resources so the status badges
     * agree with the list order and the status filter.
     */
    public function todayFor(User $user, ?string $timezone): string
    {
        return CarbonImmutable::now($this->resolveTimezone($timezone, $user))->toDateString();
    }

    /**
     * Paginate the owner's medications, filtered and ordered by relevance:
     * planned (start ↑), then active (start ↓), then finished (end ↓).
     *
     * `$filters` and `$timezone` are expected to arrive already validated
     * (see `App\Concerns\MedicationValidationRules`).
     *
     * @return LengthAwarePaginator<int, Medication>
     */
    public function paginateForUser(User $user, MedicationFilters $filters, ?string $timezone, int $perPage): LengthAwarePaginator
    {
        $today = $this->todayFor($user, $timezone);

        $query = $user->medications();

        if ($filters->q !== null && trim($filters->q) !== '') {
            $query->whereRaw(self::SEARCH_WHERE, ['%'.$this->escapeLike(mb_strtolower(trim($filters->q))).'%']);
        }

        $this->applyOverlap($query, $filters->from, $filters->to);

        $filters->status?->constrain($query, $today);

        // Name and id as the last keys keep pagination deterministic.
        return $query
            ->orderByRaw(MedicationStatus::rankSql(), [$today, $today])
            ->orderByRaw(self::PLANNED_ORDER, [$today])
            ->orderByRaw(self::ACTIVE_ORDER, [$today, $today])
            ->orderByRaw(self::FINISHED_ORDER, [$today])
            ->orderBy('name')
            ->orderBy('id')
            ->paginate($perPage);
    }

    /**
     * The owner's medications whose intake overlaps the inclusive Y-m-d period.
     *
     * @return Collection<int, Medication>
     */
    public function overlapping(User $user, string $from, string $to): Collection
    {
        $query = $user->medications();

        $this->applyOverlap($query, $from, $to);

        return $query->orderBy('name')->orderBy('dosage')->orderBy('id')->get();
    }

    /**
     * The earliest intake start (Y-m-d) among the owner's medications that
     * start on or before `$to`; null when there are none.
     */
    public function earliestStartOnOrBefore(User $user, string $to): ?string
    {
        $start = $user->medications()->where('start_date', '<=', $to)->min('start_date');

        return is_string($start) && $start !== '' ? substr($start, 0, 10) : null;
    }

    /**
     * Keep the intakes overlapping the period. Each bound is optional and
     * inclusive; an intake without an end date runs indefinitely.
     *
     * @param  HasMany<Medication, User>  $query
     */
    private function applyOverlap(HasMany $query, ?string $from, ?string $to): void
    {
        if ($from !== null) {
            $query->where(fn ($q) => $q->whereNull('end_date')->orWhere('end_date', '>=', $from));
        }

        if ($to !== null) {
            $query->where('start_date', '<=', $to);
        }
    }

    /**
     * Escape the escape character `!` (first) and the LIKE wildcards with `!`;
     * a backslash is an ordinary character here.
     */
    private function escapeLike(string $value): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value);
    }
}
