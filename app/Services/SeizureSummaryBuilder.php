<?php

namespace App\Services;

use App\Concerns\ResolvesUserTimezone;
use App\Models\User;
use App\Support\SeizureSummary;
use Carbon\CarbonImmutable;

class SeizureSummaryBuilder
{
    use ResolvesUserTimezone;

    /**
     * How many calendar days (ending today) the per-day series covers.
     */
    private const DAYS = 30;

    public function __construct(private readonly SeizureQuery $query) {}

    /**
     * Build the summary. `$from` / `$to` / `$timezone` must arrive validated.
     *
     * Days are grouped in PHP (not SQL) to stay database-agnostic.
     */
    public function build(User $user, ?string $from, ?string $to, ?string $timezone): SeizureSummary
    {
        $tz = $this->resolveTimezone($timezone, $user);
        $today = CarbonImmutable::now($tz)->startOfDay();
        $start = $today->subDays(self::DAYS - 1);

        /** @var array<string, int> $counts */
        $counts = [];
        for ($i = 0; $i < self::DAYS; $i++) {
            $counts[$start->addDays($i)->format('Y-m-d')] = 0;
        }

        $recent = $this->query
            ->forPeriod($user, $start->format('Y-m-d'), $today->format('Y-m-d'), $tz)
            ->get(['occurred_at']);

        foreach ($recent as $seizure) {
            $key = $seizure->occurred_at->setTimezone($tz)->format('Y-m-d');
            if (isset($counts[$key])) {
                $counts[$key]++;
            }
        }

        $days = [];
        foreach ($counts as $date => $count) {
            $days[] = ['date' => $date, 'count' => $count];
        }

        $periodRows = $this->query->forPeriod($user, $from, $to, $tz)->get(['occurred_at']);
        $localDays = $periodRows
            ->map(fn ($seizure) => $seizure->occurred_at->setTimezone($tz)->format('Y-m-d'))
            ->unique();

        return new SeizureSummary(
            timezone: $tz,
            today: $today->format('Y-m-d'),
            days: $days,
            period: [
                'from' => $from,
                'to' => $to,
                'total' => $periodRows->count(),
                'days_with_seizures' => $localDays->count(),
            ],
        );
    }
}
