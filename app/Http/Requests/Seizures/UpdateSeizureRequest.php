<?php

namespace App\Http\Requests\Seizures;

use App\Concerns\ReadsValidatedInput;
use App\Concerns\SeizureValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate a web-side update of a seizure row.
 *
 * The `occurred_at` field is required here (unlike the API, where its absence
 * means "now"): the edit dialog always carries a moment, so a missing value is
 * a client bug, not a valid request. `timezone` is not part of the payload —
 * the naive moment is interpreted in the owner's profile timezone by the
 * shared normalizer / validation trait.
 */
class UpdateSeizureRequest extends FormRequest
{
    use ReadsValidatedInput;
    use SeizureValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * `occurredAtRules()` cannot be reused as-is: it includes `nullable`, which
     * is the API semantics ("absent means now") and would let the edit dialog
     * pass an empty field through.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'occurred_at' => ['required', 'string', 'date'],
            'comment' => $this->commentRules(),
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $this->validateOccurredAtIsNotInFuture($validator);
        });
    }

    /**
     * Get the raw moment of the seizure, if any was submitted.
     */
    public function occurredAtInput(): ?string
    {
        return $this->filledString('occurred_at');
    }

    /**
     * Get the comment of the seizure, if any was submitted.
     */
    public function commentInput(): ?string
    {
        return $this->filledString('comment');
    }
}
