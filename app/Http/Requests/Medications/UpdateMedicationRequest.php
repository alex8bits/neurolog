<?php

namespace App\Http\Requests\Medications;

use App\Concerns\MedicationValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate a web-side update of a medication (full replacement: an empty
 * `end_date` clears the end date).
 *
 * `intake_days`/`break_days` are the exception: when both are absent the stored cycle is kept
 * (old mobile clients don't know it); `null` resets to daily.
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
     * @return array{medication_name_id: int|null, name: string|null, dosage: string, unit: string, start_date: string, end_date: string|null, cycle?: array{intake_days: int, break_days: int}}
     */
    public function medicationInput(): array
    {
        return $this->medicationAttributes();
    }
}
