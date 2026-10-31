<?php

namespace App\Http\Requests\MedicationNames;

use App\Concerns\MedicationNameValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate a new dictionary entry submitted from the web page.
 */
class StoreMedicationNameRequest extends FormRequest
{
    use MedicationNameValidationRules;

    /**
     * @return array<string, array<int, ValidationRule|\Closure|string>>
     */
    public function rules(): array
    {
        return $this->medicationNameRules();
    }

    /**
     * The validated, trimmed name.
     */
    public function nameInput(): string
    {
        return $this->medicationNameInput();
    }
}
