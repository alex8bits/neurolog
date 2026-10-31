<?php

namespace App\Http\Requests\MedicationNames;

use App\Concerns\MedicationNameValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate a dictionary entry rename submitted from the web page.
 */
class UpdateMedicationNameRequest extends FormRequest
{
    use MedicationNameValidationRules;

    /**
     * @return array<string, array<int, ValidationRule|\Closure|string>>
     */
    public function rules(): array
    {
        $id = $this->route('medicationName');

        return $this->medicationNameRules(is_scalar($id) ? (string) $id : null);
    }

    /**
     * The validated, trimmed name.
     */
    public function nameInput(): string
    {
        return $this->medicationNameInput();
    }
}
