<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Seizure;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The stable JSON shape of a seizure record.
 *
 * `user_id` and `deleted_at` are deliberately never exposed. Moments are always
 * rendered as UTC instants — converting them into the user's timezone is the
 * job of the web layer (срез 3), not of the API contract.
 *
 * @mixin Seizure
 */
class SeizureResource extends JsonResource
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
            'occurred_at' => $this->occurred_at->toIso8601ZuluString('microsecond'),
            'comment' => $this->comment,
            'created_at' => $this->created_at?->toIso8601ZuluString('microsecond'),
        ];
    }
}
