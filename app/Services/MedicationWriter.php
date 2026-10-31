<?php

namespace App\Services;

use App\Models\Medication;
use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MedicationWriter
{
    public function __construct(private readonly MedicationNameWriter $names) {}

    /**
     * Create a medication for the given owner.
     *
     * `medication_name_id` wins over `name`; a bare `name` is found-or-created
     * in the owner's dictionary (old mobile clients send only `name`).
     *
     * @param  array{medication_name_id: int|null, name: string|null, dosage: string, unit: string, start_date: string, end_date: string|null}  $attributes
     */
    public function create(User $user, array $attributes): Medication
    {
        return DB::transaction(function () use ($user, $attributes): Medication {
            $entry = $this->resolveName($user, $attributes);

            $medication = $user->medications()->create([
                'medication_name_id' => $entry->id,
                'dosage' => $attributes['dosage'],
                'unit' => $attributes['unit'],
                'start_date' => $attributes['start_date'],
                'end_date' => $attributes['end_date'],
            ]);
            $medication->setRelation('medicationName', $entry);

            return $medication;
        });
    }

    /**
     * Replace the attributes of one of the owner's medications (PUT semantics:
     * `end_date => null` clears the end date).
     *
     * Resolved through the owner relation so a foreign, missing or deleted id
     * throws `ModelNotFoundException` (404) and leaves the row intact (and
     * creates no dictionary entry). `$id` stays a `string` for the same reason
     * as in `SeizureWriter::update()`.
     *
     * @param  array{medication_name_id: int|null, name: string|null, dosage: string, unit: string, start_date: string, end_date: string|null}  $attributes
     */
    public function update(User $user, string $id, array $attributes): Medication
    {
        return DB::transaction(function () use ($user, $id, $attributes): Medication {
            $medication = $user->medications()->findOrFail($id);
            $entry = $this->resolveName($user, $attributes);

            $medication->update([
                'medication_name_id' => $entry->id,
                'dosage' => $attributes['dosage'],
                'unit' => $attributes['unit'],
                'start_date' => $attributes['start_date'],
                'end_date' => $attributes['end_date'],
            ]);
            $medication->setRelation('medicationName', $entry);

            return $medication;
        });
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

    /**
     * The dictionary entry for the payload: the chosen one (owner-scoped, a
     * foreign id throws `ModelNotFoundException`) or found-or-created by name.
     *
     * @param  array{medication_name_id: int|null, name: string|null, ...}  $attributes
     */
    private function resolveName(User $user, array $attributes): MedicationName
    {
        if ($attributes['medication_name_id'] !== null) {
            return $user->medicationNames()->findOrFail((string) $attributes['medication_name_id']);
        }

        return $this->names->resolve($user, $attributes['name'] ?? '');
    }
}
