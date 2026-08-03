<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\ReadsValidatedInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class IndexSeizureRequest extends FormRequest
{
    use ReadsValidatedInput;

    /**
     * The page size used when the client does not ask for a specific one.
     */
    private const DEFAULT_PER_PAGE = 50;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'timezone' => ['nullable', 'string', 'timezone'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * Get the lower bound of the period, if any was submitted.
     */
    public function fromInput(): ?string
    {
        return $this->filledString('from');
    }

    /**
     * Get the upper bound of the period, if any was submitted.
     */
    public function toInput(): ?string
    {
        return $this->filledString('to');
    }

    /**
     * Get the timezone the period bounds should be interpreted in, if any.
     */
    public function timezoneInput(): ?string
    {
        return $this->filledString('timezone');
    }

    /**
     * Get the requested page size, falling back to the default.
     */
    public function perPage(): int
    {
        $value = $this->validated('per_page');

        if (! is_numeric($value)) {
            return self::DEFAULT_PER_PAGE;
        }

        return (int) $value;
    }
}
