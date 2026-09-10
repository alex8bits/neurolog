<?php

namespace App\Http\Resources\Api\V1;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The stable JSON shape of a user profile.
 *
 * Only the fields the mobile profile form needs are listed explicitly.
 * `password` and the two-factor secret columns are additionally hidden on
 * the model, but the freeze rests on this explicit list alone: nothing is
 * serialized unless spelled out here, so `email_verified_at` (not hidden
 * on the model) or any future column cannot leak into the contract.
 *
 * @mixin User
 */
class UserResource extends JsonResource
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
            'email' => $this->email,
            'timezone' => $this->timezone,
        ];
    }
}
