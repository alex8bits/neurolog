<?php

namespace App\Http\Requests\Api\V1;

use App\Concerns\PasswordValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PasswordUpdateRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * The same rules as the web password update — the trait is the single
     * source of truth, so the API and web forms can never drift apart. The
     * `current_password` rule checks the hash against the sanctum-guard
     * user, exactly as in `ProfileDeleteRequest`.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'current_password' => $this->currentPasswordRules(),
            'password' => $this->passwordRules(),
        ];
    }
}
