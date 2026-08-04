<?php

namespace App\Support;

use App\Http\Resources\SeizureRowResource;
use App\Models\Seizure;

/**
 * One day in a {@see SeizurePeriodReport}: the rendered header plus the
 * formatted rows, already in the owner's timezone.
 *
 * The `date` header and the per-row `date` / `time` strings use the same
 * `d.m.Y` / `H:i` formats the web journal relies on via
 * {@see SeizureRowResource}. The resource is the single source of truth
 * for these formats (see its class docblock), so this DTO re-renders them
 * with the owner's timezone explicitly instead of reading it from the
 * request, which would not be available at report-building time.
 */
final readonly class SeizurePeriodDay
{
    /**
     * @param  array<int, array<string, mixed>>  $entries
     */
    public function __construct(
        public string $date,         // 'дд.мм.гггг' in the owner's timezone
        public array $entries,       // same shape as SeizureRowResource::toArray()
    ) {}

    /**
     * Build a day from a list of seizures that share the same calendar date
     * in the given timezone.
     *
     * The caller is responsible for ordering the input list by `occurred_at`
     * ASC; the day header is taken from the first entry, and entries are
     * kept in the order received.
     *
     * @param  array<int, Seizure>  $seizures
     */
    public static function fromSeizures(array $seizures, string $timezone): self
    {
        $entries = [];
        $header = null;

        foreach ($seizures as $seizure) {
            $moment = $seizure->occurred_at->setTimezone($timezone);

            $entries[] = [
                'id' => $seizure->id,
                'date' => $moment->format('d.m.Y'),
                'time' => $moment->format('H:i'),
                'comment' => $seizure->comment,
            ];

            $header ??= $moment->format('d.m.Y');
        }

        return new self($header ?? '', $entries);
    }
}
