<?php

namespace App\Services;

use App\Concerns\ResolvesUserTimezone;
use App\Models\Seizure;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SeizureQuery
{
    use ResolvesUserTimezone;

    /**
     * Paginate the owner's seizures within the given period.
     *
     * `$from`, `$to` and `$timezone` are expected to arrive already validated
     * (see `IndexSeizureRequest`) — see {@see self::forPeriod()}.
     *
     * @return LengthAwarePaginator<int, Seizure>
     */
    public function paginateForPeriod(
        User $user,
        ?string $from = null,
        ?string $to = null,
        ?string $timezone = null,
        int $perPage = 50,
    ): LengthAwarePaginator {
        $query = $this->forPeriod($user, $from, $to, $timezone);

        // The secondary sort by id keeps pagination deterministic when several
        // records share the very same occurred_at value.
        return $query
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    /**
     * Build the owner-scoped query for the given period.
     *
     * Both bounds are inclusive and interpreted as whole days in the resolved
     * timezone, then translated into UTC instants for the comparison.
     *
     * `$from`, `$to` (`Y-m-d`) and `$timezone` (IANA name) are expected to
     * arrive already validated (see `IndexSeizureRequest`): an unparseable
     * bound or an unknown timezone makes `CarbonImmutable::parse()` throw
     * rather than produce a validation error.
     *
     * @return HasMany<Seizure, User>
     */
    public function forPeriod(
        User $user,
        ?string $from = null,
        ?string $to = null,
        ?string $timezone = null,
    ): HasMany {
        $tz = $this->resolveTimezone($timezone, $user);

        $query = $user->seizures();

        if ($from !== null && trim($from) !== '') {
            $query->where(
                'occurred_at',
                '>=',
                CarbonImmutable::parse(trim($from), $tz)->startOfDay()->setTimezone('UTC'),
            );
        }

        if ($to !== null && trim($to) !== '') {
            $query->where(
                'occurred_at',
                '<=',
                CarbonImmutable::parse(trim($to), $tz)->endOfDay()->setTimezone('UTC'),
            );
        }

        return $query;
    }
}
