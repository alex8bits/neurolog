<?php

namespace App\Models;

use App\Enums\MedicationStatus;
use App\Enums\MedicationUnit;
use Carbon\CarbonImmutable;
use Database\Factories\MedicationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id
 * @property int $medication_name_id
 * @property string $dosage
 * @property MedicationUnit $unit
 * @property int $intake_days
 * @property int $break_days
 * @property CarbonImmutable $start_date
 * @property CarbonImmutable|null $end_date
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read User $user
 * @property-read MedicationName $medicationName
 */
#[Fillable(['medication_name_id', 'dosage', 'unit', 'intake_days', 'break_days', 'start_date', 'end_date'])]
class Medication extends Model
{
    /** @use HasFactory<MedicationFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Defaults for a new intake: daily (matches the column defaults).
     *
     * @var array<string, int>
     */
    protected $attributes = [
        'intake_days' => 1,
        'break_days' => 0,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dosage' => 'decimal:5',
            'unit' => MedicationUnit::class,
            'intake_days' => 'integer',
            'break_days' => 'integer',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
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
     * The owner's dictionary entry this intake refers to.
     *
     * @return BelongsTo<MedicationName, $this>
     */
    public function medicationName(): BelongsTo
    {
        return $this->belongsTo(MedicationName::class);
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
