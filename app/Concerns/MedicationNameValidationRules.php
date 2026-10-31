<?php

namespace App\Concerns;

use App\Models\MedicationName;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

trait MedicationNameValidationRules
{
    use ReadsValidatedInput;

    /**
     * The authenticated user (provided by the FormRequest using this trait).
     */
    abstract public function user($guard = null);

    /**
     * Get the validation rules used to validate a dictionary entry payload.
     *
     * @return array<string, array<int, ValidationRule|Closure|string>>
     */
    protected function medicationNameRules(?string $ignoreId = null): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, Closure $fail) use ($ignoreId): void {
                    if (! is_string($value)) {
                        return;
                    }

                    $user = $this->user();

                    if (! $user instanceof User) {
                        return;
                    }

                    $taken = $user->medicationNames()
                        ->where('name_search', MedicationName::fold($value))
                        ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
                        ->exists();

                    if ($taken) {
                        $fail('Такое лекарство уже есть в справочнике.');
                    }
                },
            ],
        ];
    }

    /**
     * Get the validation rules used to validate the dictionary list filter.
     *
     * @return array<string, array<int, string>>
     */
    protected function medicationNameFilterRules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * The validated, trimmed name.
     */
    protected function medicationNameInput(): string
    {
        /** @var array<string, mixed> $validated */
        $validated = $this->validated();
        $name = $validated['name'] ?? '';

        return is_string($name) ? trim($name) : '';
    }
}
