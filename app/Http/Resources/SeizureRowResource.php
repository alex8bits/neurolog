<?php

namespace App\Http\Resources;

use App\Models\Seizure;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A seizure as the web journal shows it: already formatted in the owner's
 * timezone, so the client performs no timezone arithmetic of its own.
 *
 * The formats `d.m.Y` / `H:i` are shared with the DOCX export (срез 4) so the
 * table and the document never disagree on what a row "looks like".
 *
 * @mixin Seizure
 */
class SeizureRowResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $timezone = $request->user()?->timezone ?: 'UTC';
        $moment = $this->occurred_at->setTimezone($timezone);

        return [
            'id' => $this->id,
            'date' => $moment->format('d.m.Y'),
            'time' => $moment->format('H:i'),
            'comment' => $this->comment,
            // Ready-to-use value for `<input type="datetime-local">` in the edit dialog.
            'occurred_at_local' => $moment->format('Y-m-d\TH:i'),
        ];
    }
}
