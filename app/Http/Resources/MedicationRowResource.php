<?php

namespace App\Http\Resources;

use App\Models\Medication;
use App\Services\MedicationQuery;
use App\Support\MedicationDosage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A medication as the web page shows it: labels already formatted, raw
 * values ready for the edit form, status computed for "today" in the owner's
 * profile timezone.
 *
 * The controller computes "today" once and puts it into the request
 * attributes under {@see self::TODAY_ATTRIBUTE}, so every row (and the list
 * order) agrees on the same day.
 *
 * @mixin Medication
 */
class MedicationRowResource extends JsonResource
{
    /**
     * Request attribute holding today's Y-m-d date in the owner's timezone.
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
            'name' => $this->name,
            // Ready-to-use value for the dosage input of the edit dialog.
            'dosage' => $this->dosage,
            'dosage_label' => MedicationDosage::format($this->dosage, $this->unit),
            'unit' => $this->unit->value,
            // Ready-to-use values for `<input type="date">`.
            'start_date' => $this->start_date->format('Y-m-d'),
            'end_date' => $this->end_date?->format('Y-m-d'),
            'start_label' => $this->start_date->format('d.m.Y'),
            'end_label' => $this->end_date?->format('d.m.Y'),
            'status' => $this->resource->status($this->today($request))->value,
        ];
    }

    /**
     * Today's Y-m-d date: the controller's value, or the owner's profile day.
     */
    private function today(Request $request): string
    {
        $today = $request->attributes->get(self::TODAY_ATTRIBUTE);

        if (is_string($today)) {
            return $today;
        }

        return app(MedicationQuery::class)->todayFor($request->user(), null);
    }
}
