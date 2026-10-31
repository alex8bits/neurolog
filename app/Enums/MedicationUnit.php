<?php

namespace App\Enums;

enum MedicationUnit: string
{
    case Mg = 'mg';
    case Ml = 'ml';
    case Pil = 'pil';

    /**
     * Human-readable (Russian) unit label.
     */
    public function label(): string
    {
        return match ($this) {
            self::Mg => 'мг',
            self::Ml => 'мл',
            self::Pil => 'таб'
        };
    }
}
