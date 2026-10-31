<?php

namespace App\Services;

use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MedicationNameWriter
{
    /**
     * Find the owner's entry by the folded name or create it. An existing entry is never renamed.
     */
    public function resolve(User $user, string $name): MedicationName
    {
        $fold = MedicationName::fold($name);

        $existing = $user->medicationNames()->where('name_search', $fold)->first();

        if ($existing !== null) {
            return $existing;
        }

        try {
            return $user->medicationNames()->create(['name' => $name]);
        } catch (UniqueConstraintViolationException) {
            // A concurrent request created the same name first.
            return $user->medicationNames()->where('name_search', $fold)->firstOrFail();
        }
    }

    /**
     * Create a dictionary entry. Uniqueness is checked by the FormRequest.
     */
    public function create(User $user, string $name): MedicationName
    {
        $entry = $user->medicationNames()->create(['name' => $name]);

        return $entry->loadCount('medications');
    }

    /**
     * Rename one of the owner's entries.
     *
     * Resolved through the owner relation so a foreign or missing id throws
     * `ModelNotFoundException` (404). `$id` stays a `string` for the same
     * reason as in `MedicationWriter::update()`.
     */
    public function rename(User $user, string $id, string $name): MedicationName
    {
        $entry = $user->medicationNames()->findOrFail($id);

        $entry->update(['name' => $name]);

        return $entry->loadCount('medications');
    }

    /**
     * Delete one of the owner's entries unless live medications still use it;
     * soft-deleted medications go away together with the entry.
     *
     * @throws ValidationException
     */
    public function delete(User $user, string $id): void
    {
        $entry = $user->medicationNames()->findOrFail($id);

        $used = $entry->medications()->count();

        if ($used > 0) {
            $word = $used % 10 === 1 && $used % 100 !== 11 ? 'записи' : 'записях';

            throw ValidationException::withMessages([
                'medication_name' => "Лекарство используется в {$used} {$word}.",
            ]);
        }

        DB::transaction(function () use ($entry): void {
            $entry->medications()->onlyTrashed()->forceDelete();
            $entry->delete();
        });
    }
}
