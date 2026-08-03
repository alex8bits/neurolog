<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\ReadsValidatedInput;
use App\Concerns\SeizureValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class StoreSeizureRequest extends FormRequest
{
    use ReadsValidatedInput;
    use SeizureValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->seizureRules();
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

    /**
     * Get the timezone the naive moment should be interpreted in, if any.
     */
    public function timezoneInput(): ?string
    {
        return $this->filledString('timezone');
    }
}
