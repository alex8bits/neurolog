<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * The intake cycle "N days on, M days off", counted from the start date
 * (the first day is an intake day). One label shared by the list and the
 * reports — "приём 1 дн. / перерыв 2 дн."; a daily intake (no break days)
 * has no label. Reports list a cycled medication only on its intake days.
 */
final class MedicationCycle
{
    public static function isDaily(int $breakDays): bool
    {
        return $breakDays === 0;
    }

    public static function label(int $intakeDays, int $breakDays): ?string
    {
        if (self::isDaily($breakDays)) {
            return null;
        }

        return "приём {$intakeDays} дн. / перерыв {$breakDays} дн.";
    }

    /**
     * @param  string  $start  'Y-m-d', the first intake day
     * @param  string  $date  'Y-m-d', not before $start
     */
    public static function isIntakeDay(int $intakeDays, int $breakDays, string $start, string $date): bool
    {
        if (self::isDaily($breakDays)) {
            return true;
        }

        $offset = (int) abs(CarbonImmutable::parse($start)->diffInDays(CarbonImmutable::parse($date)));

        return $offset % ($intakeDays + $breakDays) < $intakeDays;
    }
}
