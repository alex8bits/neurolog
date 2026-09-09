<?php

namespace App\Support;

use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * The journal's default period: the last 7 calendar days (today included)
 * in the owner's profile timezone — the same window the web journal list
 * opens with and the mobile client's «7 дней» preset produces.
 *
 * Shared by every period-driven action (list, DOCX download, print,
 * self/doctor email): without an explicit bound and without the explicit
 * `all` escape (`?all=1`) no path hands out the whole journal.
 */
final readonly class DefaultJournalPeriod
{
    /**
     * Apply the default to already-validated bounds: any explicit bound
     * keeps the open-ended meaning (a missing side stays unbounded), the
     * `all` flag opts out of the default entirely.
     *
     * @return array{from: ?string, to: ?string}
     */
    public static function bounds(?string $from, ?string $to, bool $all, ?User $user): array
    {
        if ($from !== null || $to !== null || $all) {
            return ['from' => $from, 'to' => $to];
        }

        $today = CarbonImmutable::now($user?->timezone ?: 'UTC');

        return [
            'from' => $today->subDays(6)->toDateString(),
            'to' => $today->toDateString(),
        ];
    }
}
