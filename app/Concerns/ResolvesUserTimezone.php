<?php

namespace App\Concerns;

use App\Models\User;

trait ResolvesUserTimezone
{
    /**
     * Resolve the timezone a naive date or moment should be interpreted in.
     */
    protected function resolveTimezone(?string $requested, ?User $user = null): string
    {
        if ($requested !== null && trim($requested) !== '') {
            return trim($requested);
        }

        return $user?->timezone ?: 'UTC';
    }
}
