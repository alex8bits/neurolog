<?php

namespace App\Concerns;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

trait ProfileValidationRules
{
    /**
     * Get the validation rules used to validate user profiles.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function profileRules(?int $userId = null): array
    {
        return [
            'name' => $this->nameRules(),
            'email' => $this->emailRules($userId),
            'timezone' => $this->profileTimezoneRules(),
        ];
    }

    /**
     * Get the validation rules used to validate user names.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function nameRules(): array
    {
        return ['required', 'string', 'max:255'];
    }

    /**
     * Get the validation rules used to validate user emails.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function emailRules(?int $userId = null): array
    {
        return [
            'required',
            'string',
            'email',
            'max:255',
            $userId === null
                ? Rule::unique(User::class)
                : Rule::unique(User::class)->ignore($userId),
        ];
    }

    /**
     * Get the validation rules used to validate user timezones.
     *
     * Nullable on purpose: the trait is shared with registration, where the
     * field may legitimately be missing (JS disabled, old mobile client) — the
     * fallback to UTC happens in CreateNewUser.
     *
     * Named with a `profile` prefix to avoid colliding with
     * {@see SeizureValidationRules::timezoneRules()}, which a class
     * could legitimately pull in alongside this trait.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function profileTimezoneRules(): array
    {
        return ['nullable', 'string', 'timezone'];
    }
}
