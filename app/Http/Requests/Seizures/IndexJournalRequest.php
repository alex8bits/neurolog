<?php

namespace App\Http\Requests\Seizures;

use App\Concerns\JournalValidationRules;
use App\Concerns\ReadsValidatedInput;
use App\Support\DefaultJournalPeriod;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate the `from` / `to` query parameters of the web journal.
 *
 * `timezone` and `per_page` are intentionally not accepted: the timezone is
 * always resolved from the owner's profile, the page size is fixed by the
 * controller.
 *
 * The extra `all` flag is the explicit escape from the default period
 * (see {@see DefaultJournalPeriod}): `?all=1` shows the whole journal.
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
        return [
            ...$this->periodRules(),
            'all' => ['sometimes', 'boolean'],
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
     * Period bounds with the journal's default applied — see
     * {@see DefaultJournalPeriod::bounds()}.
     *
     * @return array{from: ?string, to: ?string}
     */
    public function defaultedPeriod(): array
    {
        return DefaultJournalPeriod::bounds(
            $this->fromInput(),
            $this->toInput(),
            $this->boolean('all'),
            $this->user(),
        );
    }
}
