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
     * @return array{name: string, dosage: string, unit: string, start_date: string, end_date: string|null}
     */
    public function medicationInput(): array
    {
        return $this->medicationAttributes();
    }
}
