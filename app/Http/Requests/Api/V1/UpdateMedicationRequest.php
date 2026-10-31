<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\MedicationValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate an API payload replacing a medication.
 *
 * PUT semantics: the client always sends every field (`medication_name_id` or `name`, `dosage`,
 * `unit`, `start_date`, `end_date`); `end_date === null` clears the end date.
 * The rules are exactly those of {@see StoreMedicationRequest} — both
 * operations share `MedicationValidationRules`.
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
     * Get the writer attributes from the validated payload.
     *
     * Named so as not to shadow `FormRequest::attributes()` (validation labels).
     *
     * @return array{medication_name_id: int|null, name: string|null, dosage: string, unit: string, start_date: string, end_date: string|null}
     */
    public function medicationInput(): array
    {
        return $this->medicationAttributes();
    }
}
