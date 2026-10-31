<?php

namespace App\Services;

use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class MedicationNameQuery
{
    /**
     * The owner's dictionary ordered by name, each with the count of live medications.
     *
     * `!` is the LIKE escape character because it reads the same in SQLite and
     * MySQL (a backslash in a MySQL string literal breaks the statement).
     *
     * @return Collection<int, MedicationName>
     */
    public function allForUser(User $user, ?string $q = null): Collection
    {
        $query = $user->medicationNames()->withCount('medications');

        $q = trim($q ?? '');

        if ($q !== '') {
            $query->whereRaw(
                "name_search LIKE ? ESCAPE '!'",
                ['%'.$this->escapeLike(MedicationName::fold($q)).'%'],
            );
        }

        return $query->orderBy('name')->orderBy('id')->get();
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value);
    }
}
