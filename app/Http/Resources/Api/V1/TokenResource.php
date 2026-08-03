<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The stable JSON shape of an auth token response.
 *
 * The wrapped resource is the array returned by `App\Services\TokenService`, so
 * values are read through `$this->resource[...]`: property access on a
 * `JsonResource` forwards to an object and would fail on an array.
 *
 * @property-read array{access_token: string, refresh_token: string, token_type: string, expires_in: int} $resource
 */
class TokenResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'access_token' => $this->resource['access_token'],
            'refresh_token' => $this->resource['refresh_token'],
            'token_type' => $this->resource['token_type'],
            'expires_in' => $this->resource['expires_in'],
        ];
    }
}
