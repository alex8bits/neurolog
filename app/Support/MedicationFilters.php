<?php

namespace App\Support;

use App\Enums\MedicationStatus;

/**
 * The validated filters of the medications list.
 *
 * `from` / `to` are inclusive Y-m-d bounds of a period the intake must
 * overlap; `q` is the raw search string (case folding and LIKE escaping
 * happen in `MedicationQuery`).
 */
final readonly class MedicationFilters
{
    public function __construct(
        public ?string $q,
        public ?string $from,
        public ?string $to,
        public ?MedicationStatus $status,
    ) {}

    /**
     * The filters as the `filters` Inertia prop.
     *
     * @return array{q: string|null, from: string|null, to: string|null, status: string|null}
     */
    public function toArray(): array
    {
        return [
            'q' => $this->q,
            'from' => $this->from,
            'to' => $this->to,
            'status' => $this->status?->value,
        ];
    }
}
