<?php

namespace App\Concerns;

use App\Enums\MedicationStatus;
use App\Enums\MedicationUnit;
use App\Support\MedicationFilters;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

trait MedicationValidationRules
{
    use JournalValidationRules, ReadsValidatedInput;

    /**
     * Get the validation rules used to validate medication payloads.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string|object>>
     */
    protected function medicationRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'dosage' => ['required', 'numeric', 'gt:0', 'max:999999.99', 'decimal:0,2'],
            'unit' => ['required', Rule::enum(MedicationUnit::class)],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ];
    }

    /**
     * Get the validation rules used to validate the medications list filters.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string|object>>
     */
    protected function medicationFilterRules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            ...$this->periodRules(),
            'status' => ['nullable', Rule::enum(MedicationStatus::class)],
        ];
    }

    /**
     * Build the writer attributes from the validated payload.
     *
     * @return array{name: string, dosage: string, unit: string, start_date: string, end_date: string|null}
     */
    protected function medicationAttributes(): array
    {
        /** @var array<string, mixed> $validated */
        $validated = $this->validated();

        return [
            'name' => trim($this->stringValue($validated, 'name')),
            'dosage' => $this->stringValue($validated, 'dosage'),
            'unit' => $this->stringValue($validated, 'unit'),
            'start_date' => $this->stringValue($validated, 'start_date'),
            'end_date' => $this->filledString('end_date'),
        ];
    }

    /**
     * Build the list filters from the validated query string.
     */
    protected function medicationFilters(): MedicationFilters
    {
        /** @var array<string, mixed> $validated */
        $validated = $this->validated();
        $status = $validated['status'] ?? null;
        $q = trim($this->filledString('q') ?? '');

        return new MedicationFilters(
            q: $q !== '' ? $q : null,
            from: $this->normalizeBound($validated, 'from'),
            to: $this->normalizeBound($validated, 'to'),
            status: is_string($status) ? MedicationStatus::tryFrom($status) : null,
        );
    }

    /**
     * Read a validated scalar as a string (numbers arrive as int/float from JSON).
     *
     * @param  array<string, mixed>  $validated
     */
    private function stringValue(array $validated, string $key): string
    {
        $value = $validated[$key] ?? '';

        return is_scalar($value) ? (string) $value : '';
    }
}
