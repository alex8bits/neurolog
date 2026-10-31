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
     * The authenticated user (provided by the FormRequest using this trait).
     */
    abstract public function user($guard = null);

    /**
     * Get the validation rules used to validate medication payloads.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string|object>>
     */
    protected function medicationRules(): array
    {
        return [
            'medication_name_id' => [
                'nullable',
                'integer',
                'required_without:name',
                Rule::exists('medication_names', 'id')->where('user_id', $this->user()?->getAuthIdentifier()),
            ],
            'name' => ['nullable', 'string', 'max:255', 'required_without:medication_name_id'],
            'dosage' => ['required', 'numeric', 'gt:0', 'max:999999.99999', 'decimal:0,5'],
            'unit' => ['required', Rule::enum(MedicationUnit::class)],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            // Цикл «N дней приём, M дней перерыв»: пара приходит вместе или не приходит вовсе (одно поле без другого — 422)
            // Старый мобильный клиент её не шлёт — тогда ключей нет и цикл записи не меняется. null/null — ежедневно.
            'intake_days' => ['nullable', 'integer', 'min:1', 'max:365', 'required_with:break_days'],
            'break_days' => ['nullable', 'integer', 'min:0', 'max:365', 'required_with:intake_days'],
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
     * `medication_name_id` wins over `name`; `name` is only kept when no id is given.
     *
     * The `cycle` key depends on the payload: without `intake_days`/`break_days`
     * it is absent (the stored cycle stays); with a numeric pair it holds the
     * normalized pair (`break_days = 0` forces `intake_days = 1`); with a `null`
     * pair it holds the daily cycle 1/0.
     *
     * @return array{medication_name_id: int|null, name: string|null, dosage: string, unit: string, start_date: string, end_date: string|null, cycle?: array{intake_days: int, break_days: int}}
     */
    protected function medicationAttributes(): array
    {
        /** @var array<string, mixed> $validated */
        $validated = $this->validated();
        $nameId = $validated['medication_name_id'] ?? null;
        $nameId = is_numeric($nameId) ? (int) $nameId : null;
        $name = $nameId === null ? trim($this->stringValue($validated, 'name')) : '';

        $attributes = [
            'medication_name_id' => $nameId,
            'name' => $name !== '' ? $name : null,
            'dosage' => $this->stringValue($validated, 'dosage'),
            'unit' => $this->stringValue($validated, 'unit'),
            'start_date' => $this->stringValue($validated, 'start_date'),
            'end_date' => $this->filledString('end_date'),
        ];

        if (array_key_exists('intake_days', $validated) || array_key_exists('break_days', $validated)) {
            $intake = is_numeric($validated['intake_days'] ?? null) ? (int) $validated['intake_days'] : 1;
            $break = is_numeric($validated['break_days'] ?? null) ? (int) $validated['break_days'] : 0;
            if ($break === 0) {
                $intake = 1;
            }
            $attributes['cycle'] = ['intake_days' => $intake, 'break_days' => $break];
        }

        return $attributes;
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
