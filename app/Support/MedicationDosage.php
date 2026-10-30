<?php

namespace App\Support;

use App\Enums\MedicationUnit;

/**
 * The one dosage format shared by the list and the reports:
 * comma decimal separator, no trailing zeros, unit glued on (750мг, 2,5мл).
 */
final class MedicationDosage
{
    public static function format(string|float $dosage, MedicationUnit $unit): string
    {
        $number = number_format((float) $dosage, 2, ',', '');
        $number = rtrim(rtrim($number, '0'), ',');

        return $number.$unit->label();
    }
}
