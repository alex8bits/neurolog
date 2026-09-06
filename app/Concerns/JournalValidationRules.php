<?php

namespace App\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;

trait JournalValidationRules
{
    /**
     * Get the validation rules for the journal period bounds (`from` / `to`).
     *
     * The bounds are calendar days (`Y-m-d`) interpreted in the owner's
     * timezone; `SeizureQuery::forPeriod()` parses them with
     * `CarbonImmutable::parse()`, which throws on anything the date format
     * rule has not already rejected.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function periodRules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }
}
