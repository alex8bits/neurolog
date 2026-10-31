<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Medication;
use App\Models\User;
use App\Services\MedicationQuery;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The stable JSON shape of a medication record.
 *
 * `user_id` and `deleted_at` are never exposed. `name` comes from the owner's
 * dictionary entry (`medication_name_id`). `dosage` stays the decimal string
 * with 5 digits ("750.00000") so the client never sees float noise.
 * `status` is computed against the `medications_today` request attribute set
 * by the controller (the same day `MedicationQuery` filtered and ordered by);
 * without it, today in the owner's profile timezone is used.
 * `break_days = 0` means daily intake.
 *
 * @mixin Medication
 */
class MedicationResource extends JsonResource
{
    /**
     * The request attribute holding today's Y-m-d date for status badges.
     */
    public const TODAY_ATTRIBUTE = 'medications_today';

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'medication_name_id' => $this->medication_name_id,
            'name' => $this->medicationName->name,
            'dosage' => $this->dosage,
            'unit' => $this->unit->value,
            'start_date' => $this->start_date->format('Y-m-d'),
            'end_date' => $this->end_date?->format('Y-m-d'),
            'intake_days' => $this->intake_days,
            'break_days' => $this->break_days,
            'status' => $this->status($this->today($request))->value,
            'created_at' => $this->created_at?->toIso8601ZuluString('microsecond'),
        ];
    }

    /**
     * Today's Y-m-d date the status is computed against.
     */
    private function today(Request $request): string
    {
        $today = $request->attributes->get(self::TODAY_ATTRIBUTE);

        if (is_string($today)) {
            return $today;
        }

        $user = $request->user();

        return app(MedicationQuery::class)->todayFor($user instanceof User ? $user : $this->user, null);
    }
}
