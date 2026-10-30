<?php

namespace App\Models;

use App\Enums\MedicationStatus;
use App\Enums\MedicationUnit;
use Carbon\CarbonImmutable;
use Database\Factories\MedicationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $name_search
 * @property string $dosage
 * @property MedicationUnit $unit
 * @property CarbonImmutable $start_date
 * @property CarbonImmutable|null $end_date
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read User $user
 */
#[Fillable(['name', 'dosage', 'unit', 'start_date', 'end_date'])]
#[Hidden(['name_search'])]
class Medication extends Model
{
    /** @use HasFactory<MedicationFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dosage' => 'decimal:2',
            'unit' => MedicationUnit::class,
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    /**
     * Keep the case-folded search column in sync with the name.
     */
    protected static function booted(): void
    {
        static::saving(function (self $medication): void {
            $medication->name_search = mb_strtolower($medication->name);
        });
    }

    /**
     * The user who owns the medication.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Status of the medication on the given Y-m-d day.
     */
    public function status(string $today): MedicationStatus
    {
        return MedicationStatus::forDates(
            $this->start_date->format('Y-m-d'),
            $this->end_date?->format('Y-m-d'),
            $today,
        );
    }
}
