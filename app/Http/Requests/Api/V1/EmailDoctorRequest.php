<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\JournalValidationRules;
use App\Concerns\ReadsValidatedInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator;

/**
 * Validate the "Email doctor" payload for the mobile API: a recipient
 * address plus optional subject and body overrides.
 *
 * The `from` / `to` / `timezone` period parameters arrive in the query
 * string. They are validated separately by {@see validatedPeriod()} — not
 * by {@see rules()} — because the query `to` (a date bound) shares its key
 * with the body `to` (the recipient address) and would collide in the
 * merged input bag.
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
     * Validate the `from` / `to` / `timezone` period parameters carried by
     * the query string and return them normalized (absent or blank → null).
     *
     * Unlike the web version there is no separate error bag: a plain
     * ValidationException renders the standard 422 JSON response the
     * mobile client expects.
     *
     * @return array{from: ?string, to: ?string, timezone: ?string}
     */
    public function validatedPeriod(): array
    {
        $validated = Validator::make($this->query->all(), $this->periodRules() + [
            'timezone' => ['nullable', 'string', 'timezone'],
        ])->validate();

        return [
            'from' => $this->normalizeBound($validated, 'from'),
            'to' => $this->normalizeBound($validated, 'to'),
            'timezone' => $this->normalizeBound($validated, 'timezone'),
        ];
    }
}
