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

    /**
     * Normalize a validated period parameter: absent or blank → null.
     *
     * @param  array<string, mixed>  $validated
     */
    protected function normalizeBound(array $validated, string $key): ?string
    {
        $value = $validated[$key] ?? null;

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
