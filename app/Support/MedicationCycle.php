<?php

namespace App\Support;

/**
 * The one intake-cycle label shared by the list and the reports:
 * "приём 1 дн. / перерыв 2 дн."; a daily intake (no break days) has no label.
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
}
