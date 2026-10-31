<?php

namespace Tests\Unit\Support;

use App\Support\MedicationCycle;
use PHPUnit\Framework\TestCase;

class MedicationCycleTest extends TestCase
{
    public function test_daily_intake_has_no_label(): void
    {
        $this->assertNull(MedicationCycle::label(1, 0));
    }

    public function test_cycle_label(): void
    {
        $this->assertSame('приём 1 дн. / перерыв 2 дн.', MedicationCycle::label(1, 2));
    }

    public function test_intake_day_follows_the_cycle_from_start(): void
    {
        $days = array_map(
            fn (string $date) => MedicationCycle::isIntakeDay(2, 1, '2026-10-30', $date),
            ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'],
        );

        $this->assertSame([true, true, false, true], $days);
    }
}
