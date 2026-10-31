<?php

namespace App\Enums;

enum MedicationUnit: string
{
    case Pil = 'pil';
    case Mg = 'mg';
    case Ml = 'ml';

    /**
     * Human-readable (Russian) unit label.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pil => 'таб',
            self::Mg => 'мг',
            self::Ml => 'мл',
        };
    }
}
