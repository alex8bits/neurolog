<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\MedicationNameValidationRules;
use Illuminate\Foundation\Http\FormRequest;

class IndexMedicationNameRequest extends FormRequest
{
    use MedicationNameValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return $this->medicationNameFilterRules();
    }

    /**
     * Get the trimmed search string, or null when it is empty.
     */
    public function q(): ?string
    {
        $q = $this->filledString('q');

        if ($q === null) {
            return null;
        }

        $q = trim($q);

        return $q === '' ? null : $q;
    }
}
