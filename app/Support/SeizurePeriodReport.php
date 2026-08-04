<?php

namespace App\Support;

use App\Models\User;
use App\Services\SeizureQuery;
use Carbon\CarbonImmutable;

/**
 * One user's seizures for a given period, grouped by day in the owner's
 * timezone. Days are sorted by date ASC; entries within a day are sorted
 * by `occurred_at` ASC (matches the DOCX example in the concept).
 *
 * The DTO is the single source of truth for all three renderers of slice 4
 * (DOCX, print HTML, Mailable attachment).
 *
 * Inputs (`$from`, `$to` as `Y-m-d`) are expected to arrive already validated
 * (see `IndexJournalRequest`); an unparseable bound makes
 * `CarbonImmutable::parse()` throw rather than produce a validation error.
 */
final readonly class SeizurePeriodReport
{
    /** @var array<int, SeizurePeriodDay> */
    public array $days;

    public int $totalEntries;

    public function __construct(
        public User $owner,
        public ?string $from,        // 'YYYY-MM-DD' or null
        public ?string $to,          // 'YYYY-MM-DD' or null
        SeizureQuery $query,
    ) {
        $timezone = $this->owner->timezone ?: 'UTC';

        $seizures = $query
            ->forPeriod($this->owner, $this->from, $this->to, $timezone)
            ->orderBy('occurred_at', 'asc')
            ->get();

        // Group by Y-m-d in the owner's timezone; secondary sort by
        // occurred_at ASC is provided by the query above.
        $byDate = [];
        foreach ($seizures as $seizure) {
            $key = $seizure->occurred_at->setTimezone($timezone)->format('Y-m-d');
            $byDate[$key] ??= [];
            $byDate[$key][] = $seizure;
        }
        ksort($byDate);

        $this->days = array_values(array_map(
            fn (array $day): SeizurePeriodDay => SeizurePeriodDay::fromSeizures($day, $timezone),
            $byDate,
        ));

        $this->totalEntries = $seizures->count();
    }

    /**
     * Human-readable period label for templates:
     *   - no bounds:    'весь журнал'
     *   - one bound:    'с 10.05.2026' / 'по 10.05.2026'
     *   - both, equal:  'за 10.05.2026'
     *   - both, range:  'с 10.05.2026 по 12.05.2026'
     */
    public function periodLabel(): string
    {
        if ($this->from === null && $this->to === null) {
            return 'весь журнал';
        }

        if ($this->from !== null && $this->to !== null && $this->from === $this->to) {
            return 'за '.CarbonImmutable::parse($this->from)->format('d.m.Y');
        }

        $parts = [];
        if ($this->from !== null) {
            $parts[] = 'с '.CarbonImmutable::parse($this->from)->format('d.m.Y');
        }
        if ($this->to !== null) {
            $parts[] = 'по '.CarbonImmutable::parse($this->to)->format('d.m.Y');
        }

        return implode(' ', $parts);
    }
}
