<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\MedicationNameFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $name_search
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 * @property-read Collection<int, Medication> $medications
 * @property-read int|null $medications_count
 */
#[Fillable(['name'])]
#[Hidden(['name_search'])]
class MedicationName extends Model
{
    /** @use HasFactory<MedicationNameFactory> */
    use HasFactory;

    /**
     * Case-folded, trimmed form of a name: the search and uniqueness key.
     */
    public static function fold(string $name): string
    {
        return mb_strtolower(trim($name));
    }

    /**
     * Trim the name and keep the case-folded search column in sync (works without model events).
     *
     * @return Attribute<string, string>
     */
    protected function name(): Attribute
    {
        return Attribute::make(set: fn (string $value): array => [
            'name' => trim($value),
            'name_search' => self::fold($value),
        ]);
    }

    /**
     * The user who owns the dictionary entry.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The intakes that use this name.
     *
     * @return HasMany<Medication, $this>
     */
    public function medications(): HasMany
    {
        return $this->hasMany(Medication::class);
    }
}
