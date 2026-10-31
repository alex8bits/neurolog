<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\MedicationValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate an API payload creating a medication.
 */
class StoreMedicationRequest extends FormRequest
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
     * Get the writer attributes from the validated payload.
     *
     * Named so as not to shadow `FormRequest::attributes()` (validation labels).
     *
     * @return array{medication_name_id: int|null, name: string|null, dosage: string, unit: string, start_date: string, end_date: string|null, cycle?: array{intake_days: int, break_days: int}}
     */
    public function medicationInput(): array
    {
        return $this->medicationAttributes();
    }
}
