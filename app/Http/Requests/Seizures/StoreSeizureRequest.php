<?php

namespace App\Http\Requests\Seizures;

use App\Concerns\ReadsValidatedInput;
use App\Concerns\SeizureValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate a web-side creation of a seizure row.
 *
 * The `occurred_at` field is optional: an absent or empty value means "save
 * `now()`" and the controller is expected to fall back to the current moment
 * in `UTC`. `timezone` is not part of the payload — the naive moment, when
 * present, is interpreted in the owner's profile timezone by the shared
 * normalizer / validation trait. `comment` is optional.
 */
class StoreSeizureRequest extends FormRequest
{
    use ReadsValidatedInput;
    use SeizureValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * Unlike {@see UpdateSeizureRequest::rules()}, `occurred_at` reuses the
     * shared `occurredAtRules()` (which is `nullable`): a missing value is
     * valid here and is resolved to the current moment by the writer.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'occurred_at' => $this->occurredAtRules(),
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
