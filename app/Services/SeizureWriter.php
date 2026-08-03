<?php

namespace App\Services;

use App\Concerns\ResolvesUserTimezone;
use App\Models\Seizure;
use App\Models\User;

class SeizureWriter
{
    use ResolvesUserTimezone;

    public function __construct(
        private readonly SeizureMomentNormalizer $normalizer,
    ) {}

    /**
     * Record a seizure for the given owner, normalizing the moment to UTC.
     *
     * `$occurredAt` and `$timezone` are expected to arrive already validated
     * (see `App\Concerns\SeizureValidationRules` / `StoreSeizureRequest`):
     * an unparseable moment or an unknown IANA timezone makes
     * `CarbonImmutable::parse()` throw rather than produce a validation error.
     */
    public function record(
        User $user,
        ?string $occurredAt = null,
        ?string $comment = null,
        ?string $timezone = null,
    ): Seizure {
        $moment = $this->normalizer->normalize(
            $occurredAt,
            $this->resolveTimezone($timezone, $user),
        );

        return $user->seizures()->create([
            'occurred_at' => $moment,
            'comment' => $comment,
        ]);
    }

    /**
     * Update one of the owner's seizures, normalizing the moment to UTC.
     *
     * The record is resolved through the owner relation on purpose: a foreign,
     * missing or already deleted id yields a 404 instead of touching somebody
     * else's row. `$id` stays a `string` so that a digits-only value larger
     * than `PHP_INT_MAX` matches nothing instead of blowing up as a `TypeError`
     * (see the route definition in `routes/api.php` and the corresponding
     * `destroy()` action in `App\Http\Controllers\Api\V1\SeizureController`).
     *
     * `$comment === null` means "comment cleared" — the web form (Task 5) always
     * sends the field, but the writer mirrors the `record()` signature so the
     * two operations behave the same way.
     */
    public function update(
        User $user,
        string $id,
        ?string $occurredAt = null,
        ?string $comment = null,
        ?string $timezone = null,
    ): Seizure {
        $seizure = $user->seizures()->findOrFail($id);

        $moment = $this->normalizer->normalize(
            $occurredAt,
            $this->resolveTimezone($timezone, $user),
        );

        $seizure->update([
            'occurred_at' => $moment,
            'comment' => $comment,
        ]);

        return $seizure;
    }

    /**
     * Soft delete one of the owner's seizures.
     *
     * Resolved through the owner relation so a foreign, missing or already
     * deleted id throws `ModelNotFoundException` and the row is left intact.
     */
    public function delete(User $user, string $id): void
    {
        $user->seizures()->findOrFail($id)->delete();
    }
}
