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
}
