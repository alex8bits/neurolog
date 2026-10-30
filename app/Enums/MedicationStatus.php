<?php

namespace App\Enums;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

/**
 * The single definition of a medication's status relative to "today".
 *
 * The rule exists in two representations that must stay in sync: the PHP
 * one (forDates/rank, for badges) and the SQL one (rankSql/constrain, for
 * ordering and filtering paginated lists). All dates are compared as Y-m-d
 * strings, which orders identically in SQLite (text) and MySQL (DATE).
 */
enum MedicationStatus: string
{
    case Planned = 'planned';
    case Active = 'active';
    case Finished = 'finished';

    /**
     * Status for the given Y-m-d dates; the end date is inclusive.
     */
    public static function forDates(string $startDate, ?string $endDate, string $today): self
    {
        if ($startDate > $today) {
            return self::Planned;
        }

        if ($endDate !== null && $endDate < $today) {
            return self::Finished;
        }

        return self::Active;
    }

    /**
     * Position of the status in the relevance order of the list.
     */
    public function rank(): int
    {
        return match ($this) {
            self::Planned => 0,
            self::Active => 1,
            self::Finished => 2,
        };
    }

    /**
     * SQL expression equal to rank(); expects today's Y-m-d bound twice.
     *
     * @return literal-string
     */
    public static function rankSql(): string
    {
        return 'CASE WHEN start_date > ? THEN 0 WHEN end_date IS NOT NULL AND end_date < ? THEN 2 ELSE 1 END';
    }

    /**
     * Restrict the query to records having this status on the given Y-m-d day.
     *
     * @param  Builder<*>|Relation<*, *, *>  $query
     */
    public function constrain(Builder|Relation $query, string $today): void
    {
        match ($this) {
            self::Planned => $query->where('start_date', '>', $today),
            self::Finished => $query->whereNotNull('end_date')->where('end_date', '<', $today),
            self::Active => $query
                ->where('start_date', '<=', $today)
                ->where(fn ($q) => $q->whereNull('end_date')->orWhere('end_date', '>=', $today)),
        };
    }

    /**
     * Human-readable (Russian) badge label.
     */
    public function label(): string
    {
        return match ($this) {
            self::Planned => 'Запланировано',
            self::Active => 'Идёт приём',
            self::Finished => 'Приём окончен',
        };
    }
}
