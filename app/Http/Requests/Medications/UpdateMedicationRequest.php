<?php

namespace App\Http\Requests\Medications;

use App\Concerns\MedicationValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate a web-side update of a medication (full replacement: an empty
 * `end_date` clears the end date).
 */
class UpdateMedicationRequest extends FormRequest
{
    use MedicationValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->medicationRules();
    }

    /**
     * Get the writer attributes built from the validated payload.
     *
     * @return array{medication_name_id: int|null, name: string|null, dosage: string, unit: string, start_date: string, end_date: string|null}
     */
    public function medicationInput(): array
    {
        return $this->medicationAttributes();
    }
}
