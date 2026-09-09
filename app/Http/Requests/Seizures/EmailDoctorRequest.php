<?php

namespace App\Http\Requests\Seizures;

use App\Concerns\JournalValidationRules;
use App\Concerns\ReadsValidatedInput;
use App\Support\DefaultJournalPeriod;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator;

/**
 * Validate the "Email doctor" dialog: a recipient address plus optional
 * subject and body overrides.
 *
 * The `from` / `to` period bounds (and the `all` flag) arrive as query
 * parameters on the action URL. They are validated separately by
 * {@see validatedPeriod()} — not by {@see rules()} — because the query
 * `to` (a date bound) shares its key with the body `to` (the recipient
 * address) and would collide in the merged input bag.
 */
class EmailDoctorRequest extends FormRequest
{
    use JournalValidationRules;
    use ReadsValidatedInput;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'to' => ['required', 'string', 'email:rfc', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function toInput(): ?string
    {
        return $this->filledString('to');
    }

    public function subjectInput(): ?string
    {
        return $this->filledString('subject');
    }

    public function bodyInput(): ?string
    {
        return $this->filledString('body');
    }

    /**
     * Validate the `from` / `to` / `all` period parameters carried by the
     * query string and return the bounds normalized (absent or blank →
     * null).
     *
     * On failure the ValidationException carries the `period` error bag, so
     * date errors never surface under the dialog's recipient fields.
     *
     * @return array{from: ?string, to: ?string, all: bool}
     */
    public function validatedPeriod(): array
    {
        $validated = Validator::make($this->query->all(), [
            ...$this->periodRules(),
            'all' => ['sometimes', 'boolean'],
        ])->validateWithBag('period');

        return [
            'from' => $this->normalizeBound($validated, 'from'),
            'to' => $this->normalizeBound($validated, 'to'),
            'all' => (bool) ($validated['all'] ?? false),
        ];
    }

    /**
     * Period bounds with the journal's default applied — see
     * {@see DefaultJournalPeriod::bounds()}.
     *
     * @return array{from: ?string, to: ?string}
     */
    public function defaultedPeriod(): array
    {
        $period = $this->validatedPeriod();

        return DefaultJournalPeriod::bounds(
            $period['from'],
            $period['to'],
            $period['all'],
            $this->user(),
        );
    }
}
