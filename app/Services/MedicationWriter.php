<?php

namespace App\Services;

use App\Models\Medication;
use App\Models\User;

class MedicationWriter
{
    /**
     * Create a medication for the given owner.
     *
     * @param  array{name: string, dosage: string, unit: string, start_date: string, end_date: string|null}  $attributes
     */
    public function create(User $user, array $attributes): Medication
    {
        return $user->medications()->create($attributes);
    }

    /**
     * Replace the attributes of one of the owner's medications (PUT semantics:
     * `end_date => null` clears the end date).
     *
     * Resolved through the owner relation so a foreign, missing or deleted id
     * throws `ModelNotFoundException` (404) and leaves the row intact. `$id`
     * stays a `string` for the same reason as in `SeizureWriter::update()`.
     *
     * @param  array{name: string, dosage: string, unit: string, start_date: string, end_date: string|null}  $attributes
     */
    public function update(User $user, string $id, array $attributes): Medication
    {
        $medication = $user->medications()->findOrFail($id);

        $medication->update($attributes);

        return $medication;
    }

    /**
     * Soft delete one of the owner's medications.
     *
     * Resolved through the owner relation, like {@see self::update()}.
     */
    public function delete(User $user, string $id): void
    {
        $user->medications()->findOrFail($id)->delete();
    }
}
