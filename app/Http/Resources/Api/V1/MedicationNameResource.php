<?php

namespace App\Http\Resources\Api\V1;

use App\Models\MedicationName;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The stable JSON shape of a medication dictionary entry.
 *
 * `user_id` and `name_search` are never exposed. `medications_count` is the
 * number of live (not soft-deleted) medications using this entry.
 *
 * @mixin MedicationName
 */
class MedicationNameResource extends JsonResource
{
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
            'medications_count' => $this->medications_count ?? 0,
            'created_at' => $this->created_at?->toIso8601ZuluString('microsecond'),
        ];
    }
}
