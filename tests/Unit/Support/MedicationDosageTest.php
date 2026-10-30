<?php

namespace Tests\Unit\Support;

use App\Enums\MedicationUnit;
use App\Support\MedicationDosage;
use PHPUnit\Framework\TestCase;

class MedicationDosageTest extends TestCase
{
    public function test_formats_without_trailing_zeros_and_with_glued_unit(): void
    {
        $this->assertSame('750мг', MedicationDosage::format('750.00', MedicationUnit::Mg));
        $this->assertSame('2,5мл', MedicationDosage::format('2.50', MedicationUnit::Ml));
        $this->assertSame('0,25мг', MedicationDosage::format(0.25, MedicationUnit::Mg));
    }
}
