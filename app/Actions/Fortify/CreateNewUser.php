<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        return User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
            'timezone' => $this->resolveSubmittedTimezone($input['timezone'] ?? null),
        ]);
    }

    /**
     * Fall back to UTC when the client sent no usable timezone.
     */
    private function resolveSubmittedTimezone(mixed $timezone): string
    {
        return is_string($timezone) && trim($timezone) !== '' ? trim($timezone) : 'UTC';
    }
}
