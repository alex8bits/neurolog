<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\MedicationNameValidationRules;
use Illuminate\Foundation\Http\FormRequest;

class StoreMedicationNameRequest extends FormRequest
{
    use MedicationNameValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return $this->medicationNameRules();
    }

    /**
     * Get the validated, trimmed name.
     */
    public function nameInput(): string
    {
        return $this->medicationNameInput();
    }
}
