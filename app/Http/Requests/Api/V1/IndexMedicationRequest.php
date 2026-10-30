<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\MedicationValidationRules;
use App\Support\MedicationFilters;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class IndexMedicationRequest extends FormRequest
{
    use MedicationValidationRules;

    /**
     * The page size used when the client does not ask for a specific one.
     */
    public const DEFAULT_PER_PAGE = 20;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...$this->medicationFilterRules(),
            'timezone' => ['nullable', 'string', 'timezone'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * Get the list filters from the validated query string.
     */
    public function filters(): MedicationFilters
    {
        return $this->medicationFilters();
    }

    /**
     * Get the timezone "today" should be computed in, if any.
     */
    public function timezoneInput(): ?string
    {
        return $this->filledString('timezone');
    }

    /**
     * Get the requested page size, falling back to the default.
     */
    public function perPage(): int
    {
        $value = $this->validated('per_page');

        if (! is_numeric($value)) {
            return self::DEFAULT_PER_PAGE;
        }

        return (int) $value;
    }
}
