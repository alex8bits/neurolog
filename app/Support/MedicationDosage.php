<?php

namespace App\Support;

use App\Enums\MedicationUnit;

/**
 * The one dosage format shared by the list and the reports:
 * comma decimal separator, no trailing zeros, unit glued on (750мг, 2,5мл).
 * Up to 5 decimal places are kept (0,00125мг).
 */
final class MedicationDosage
{
    public static function format(string|float $dosage, MedicationUnit $unit): string
    {
        $number = number_format((float) $dosage, 5, ',', '');
        $number = rtrim(rtrim($number, '0'), ',');

        return $number.$unit->label();
    }

    /**
     * Plain dot-decimal for an input value, no trailing zeros: "750.00000" → "750", "2.50000" → "2.5".
     */
    public static function plain(string $dosage): string
    {
        if (! str_contains($dosage, '.')) {
            return $dosage;
        }

        return rtrim(rtrim($dosage, '0'), '.');
    }
}
