<?php

namespace App\Http\Requests\Seizures;

use App\Concerns\JournalValidationRules;
use App\Concerns\ReadsValidatedInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate the `from` / `to` query parameters of the web journal.
 *
 * `timezone` and `per_page` are intentionally not accepted: the timezone is
 * always resolved from the owner's profile, the page size is fixed by the
 * controller.
 */
class IndexJournalRequest extends FormRequest
{
    use JournalValidationRules;
    use ReadsValidatedInput;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->periodRules();
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
}
