<?php

namespace App\Support;

use App\Concerns\ResolvesUserTimezone;
use App\Models\User;
use App\Services\MedicationQuery;
use App\Services\SeizureQuery;
use Carbon\CarbonImmutable;

/**
 * One user's journal for a given period, laid out day by day in the
 * resolved timezone: an explicit one (e.g. the mobile device's) or, by
 * default, the owner's profile timezone.
 *
 * The DTO is the single source of truth for all three renderers (DOCX,
 * print HTML, Mailable attachment). `$days` covers every day of the
 * effective period as {@see ReportBlock}s (see {@see ReportTimeline}): a
 * day with seizures is its own block, consecutive seizure-free days with
 * the same medications collapse into a «Без приступов» run. Entries within
 * a day are sorted by `occurred_at` ASC.
 *
 * The effective period never runs past today; an open start falls back to
 * the earliest of the first seizure and the first medication intake. With
 * nothing to show, `$days` is empty.
 *
 * Inputs (`$from`, `$to` as `Y-m-d`, `$timezone` as an IANA name) are
 * expected to arrive already validated (see `IndexJournalRequest` /
 * `IndexSeizureRequest`); an unparseable bound makes
 * `CarbonImmutable::parse()` throw rather than produce a validation error.
 */
final readonly class SeizurePeriodReport
{
    use ResolvesUserTimezone;

    /** @var list<ReportBlock> */
    public array $days;

    /** Number of seizures in the period (not of blocks). */
    public int $totalEntries;

    public function __construct(
        public User $owner,
        public ?string $from,        // 'YYYY-MM-DD' or null
        public ?string $to,          // 'YYYY-MM-DD' or null
        SeizureQuery $query,
        MedicationQuery $medications,
        ?string $timezone = null,    // IANA name; null/blank = owner's profile timezone
    ) {
        $timezone = $this->resolveTimezone($timezone, $this->owner);

        $today = CarbonImmutable::now($timezone)->toDateString();
        $effectiveTo = min($this->to ?? $today, $today);
        $effectiveFrom = $this->from ?? $this->earliestDate($query, $medications, $effectiveTo, $timezone);

        if ($effectiveFrom === null || $effectiveFrom > $effectiveTo) {
            $this->days = [];
            $this->totalEntries = 0;

            return;
        }

        $seizures = $query
            ->forPeriod($this->owner, $effectiveFrom, $effectiveTo, $timezone)
            ->orderBy('occurred_at', 'asc')
            ->get();

        // Group by Y-m-d in the resolved timezone; secondary sort by
        // occurred_at ASC is provided by the query above.
        $byDate = [];
        foreach ($seizures as $seizure) {
            $key = $seizure->occurred_at->setTimezone($timezone)->format('Y-m-d');
            $byDate[$key] ??= [];
            $byDate[$key][] = $seizure;
        }

        $seizureDays = array_map(
            fn (array $day): SeizurePeriodDay => SeizurePeriodDay::fromSeizures($day, $timezone),
            $byDate,
        );

        $this->days = ReportTimeline::build(
            $effectiveFrom,
            $effectiveTo,
            $seizureDays,
            $medications->overlapping($this->owner, $effectiveFrom, $effectiveTo),
        );

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

    /**
     * Start of an open period: the earliest of the owner's first seizure (as
     * a local date) and first medication intake, both not later than `$to`.
     * Null when the owner has neither.
     */
    private function earliestDate(SeizureQuery $query, MedicationQuery $medications, string $to, string $timezone): ?string
    {
        $candidates = [];

        $firstSeizure = $query
            ->forPeriod($this->owner, null, $to, $timezone)
            ->orderBy('occurred_at', 'asc')
            ->first();
        if ($firstSeizure !== null) {
            $candidates[] = $firstSeizure->occurred_at->setTimezone($timezone)->format('Y-m-d');
        }

        $firstIntake = $medications->earliestStartOnOrBefore($this->owner, $to);
        if ($firstIntake !== null) {
            $candidates[] = $firstIntake;
        }

        return $candidates === [] ? null : min($candidates);
    }
}
