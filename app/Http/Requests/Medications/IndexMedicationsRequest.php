<?php

namespace App\Http\Requests\Medications;

use App\Concerns\MedicationValidationRules;
use App\Support\MedicationFilters;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate the filters of the web medications list.
 *
 * `timezone` and `per_page` are intentionally not accepted: the timezone is
 * always resolved from the owner's profile, the page size is fixed by the
 * controller.
 */
class IndexMedicationsRequest extends FormRequest
{
    use MedicationValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->medicationFilterRules();
    }

    /**
     * Get the validated list filters.
     */
    public function filters(): MedicationFilters
    {
        return $this->medicationFilters();
    }
}
