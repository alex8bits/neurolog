<?php

namespace App\Support;

use App\Models\Medication;
use Carbon\CarbonImmutable;

/**
 * Lays out every day of a report period as {@see ReportBlock}s: a day with
 * seizures is its own block, consecutive seizure-free days with the same
 * set of medications collapse into one quiet run. Pure: no database access.
 */
final class ReportTimeline
{
    /**
     * @param  string  $from  inclusive 'Y-m-d'
     * @param  string  $to  inclusive 'Y-m-d'
     * @param  array<string, SeizurePeriodDay>  $seizureDays  keyed by 'Y-m-d'
     * @param  iterable<Medication>  $medications  overlapping [from, to]
     * @return list<ReportBlock>
     */
    public static function build(string $from, string $to, array $seizureDays, iterable $medications): array
    {
        $intakes = [];
        foreach ($medications as $medication) {
            $intakes[] = [
                'name' => $medication->name,
                'start' => $medication->start_date->format('Y-m-d'),
                'end' => $medication->end_date?->format('Y-m-d'),
                'line' => "{$medication->name} ".MedicationDosage::format($medication->dosage, $medication->unit),
            ];
        }
        usort($intakes, fn (array $a, array $b): int => strcmp(mb_strtolower($a['name']), mb_strtolower($b['name']))
            ?: strcmp($a['line'], $b['line']));

        $blocks = [];
        /** @var array{start: string, end: string, key: string, medications: list<string>}|null $run */
        $run = null;

        $closeRun = function () use (&$run, &$blocks): void {
            if ($run === null) {
                return;
            }

            $label = self::label($run['start']);
            if ($run['end'] !== $run['start']) {
                $label .= ' - '.self::label($run['end']);
            }

            $blocks[] = new ReportBlock($label, $run['medications'], [], true);
            $run = null;
        };

        $end = CarbonImmutable::parse($to);
        for ($day = CarbonImmutable::parse($from); $day->lte($end); $day = $day->addDay()) {
            $date = $day->format('Y-m-d');

            $set = [];
            foreach ($intakes as $intake) {
                if ($intake['start'] <= $date && ($intake['end'] === null || $intake['end'] >= $date)) {
                    $set[] = $intake['line'];
                }
            }
            $key = implode("\n", $set);

            if (isset($seizureDays[$date])) {
                $closeRun();
                $blocks[] = new ReportBlock(self::label($date), $set, array_values($seizureDays[$date]->entries), false);

                continue;
            }

            if ($run !== null && $run['key'] === $key) {
                $run['end'] = $date;

                continue;
            }

            $closeRun();
            $run = ['start' => $date, 'end' => $date, 'key' => $key, 'medications' => $set];
        }

        $closeRun();

        return $blocks;
    }

    private static function label(string $date): string
    {
        return CarbonImmutable::parse($date)->format('d.m.Y');
    }
}
