<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\MedicationNameValidationRules;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMedicationNameRequest extends FormRequest
{
    use MedicationNameValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return $this->medicationNameRules($this->routeId());
    }

    /**
     * Get the validated, trimmed name.
     */
    public function nameInput(): string
    {
        return $this->medicationNameInput();
    }

    /**
     * The id of the entry from the route, as a string.
     */
    private function routeId(): ?string
    {
        $id = $this->route('medicationName');

        return is_scalar($id) ? (string) $id : null;
    }
}
