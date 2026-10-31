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
        $this->assertSame('0,00125мг', MedicationDosage::format('0.00125', MedicationUnit::Mg));
    }

    public function test_plain_strips_trailing_zeros_for_input_value(): void
    {
        $this->assertSame('750', MedicationDosage::plain('750.00000'));
        $this->assertSame('2.5', MedicationDosage::plain('2.50000'));
    }
}
