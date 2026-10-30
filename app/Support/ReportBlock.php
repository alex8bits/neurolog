<?php

namespace App\Support;

/**
 * One block of a {@see SeizurePeriodReport}: either a single day with
 * seizures or a run of consecutive seizure-free days that share the same
 * set of medications ("Без приступов").
 */
final readonly class ReportBlock
{
    /**
     * @param  list<string>  $medications  'Вигабатрин 750мг', ordered by name
     * @param  list<array<string, mixed>>  $entries  same shape as SeizurePeriodDay::$entries; [] for a quiet run
     */
    public function __construct(
        public string $label,        // '25.10.2026' or '25.10.2026 - 28.10.2026'
        public array $medications,
        public array $entries,
        public bool $quiet,          // true — «Без приступов»
    ) {}
}
