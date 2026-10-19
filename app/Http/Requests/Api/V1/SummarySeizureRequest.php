<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\JournalValidationRules;
use App\Concerns\ReadsValidatedInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SummarySeizureRequest extends FormRequest
{
    use JournalValidationRules;
    use ReadsValidatedInput;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...$this->periodRules(),
            'timezone' => ['nullable', 'string', 'timezone'],
        ];
    }

    public function fromInput(): ?string
    {
        return $this->filledString('from');
    }

    public function toInput(): ?string
    {
        return $this->filledString('to');
    }

    public function timezoneInput(): ?string
    {
        return $this->filledString('timezone');
    }
}
