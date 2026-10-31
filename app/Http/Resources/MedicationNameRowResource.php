<?php

namespace App\Http\Resources;

use App\Models\MedicationName;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A dictionary entry as the web pages receive it.
 *
 * @mixin MedicationName
 */
class MedicationNameRowResource extends JsonResource
{
    /**
     * @return array{id: int, name: string, medications_count: int}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'medications_count' => (int) ($this->medications_count ?? 0),
        ];
    }
}
