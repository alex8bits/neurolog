<?php

namespace App\Http\Requests\Seizures;

use App\Concerns\ReadsValidatedInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validate the "Email doctor" dialog: a recipient address plus optional
 * subject and body overrides. `from` / `to` (the period bounds) are *not*
 * validated here — they arrive as query parameters and are merged into the
 * input bag by the controller before {@see IndexJournalRequest} sees them.
 */
class EmailDoctorRequest extends FormRequest
{
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
}
