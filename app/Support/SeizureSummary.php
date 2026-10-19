<?php

namespace App\Support;

/**
 * Journal summary: the last 30 calendar days (zero-filled) plus the totals of
 * the requested period. See `App\Services\SeizureSummaryBuilder`.
 */
final readonly class SeizureSummary
{
    /**
     * @param  list<array{date: string, count: int}>  $days
     * @param  array{from: ?string, to: ?string, total: int, days_with_seizures: int}  $period
     */
    public function __construct(
        public string $timezone,
        public string $today,
        public array $days,
        public array $period,
    ) {}

    /**
     * @return array{timezone: string, today: string, days: list<array{date: string, count: int}>, period: array{from: ?string, to: ?string, total: int, days_with_seizures: int}}
     */
    public function toArray(): array
    {
        return [
            'timezone' => $this->timezone,
            'today' => $this->today,
            'days' => $this->days,
            'period' => $this->period,
        ];
    }
}
