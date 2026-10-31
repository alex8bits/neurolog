<?php

namespace Tests\Unit\Support;

use App\Enums\MedicationUnit;
use App\Models\Medication;
use App\Models\MedicationName;
use App\Support\ReportTimeline;
use App\Support\SeizurePeriodDay;
use Tests\TestCase;

class ReportTimelineTest extends TestCase
{
    public function test_user_example_collapses_into_two_quiet_runs(): void
    {
        $blocks = ReportTimeline::build('2026-10-25', '2026-10-31', [], $this->exampleMedications());

        $this->assertCount(2, $blocks);

        $this->assertSame('25.10.2026 - 28.10.2026', $blocks[0]->label);
        $this->assertSame(['Вигабатрин 750мг', 'Карведилол 75мг'], $blocks[0]->medications);
        $this->assertTrue($blocks[0]->quiet);
        $this->assertSame([], $blocks[0]->entries);

        $this->assertSame('29.10.2026 - 31.10.2026', $blocks[1]->label);
        $this->assertSame(['Вигабатрин 500мг'], $blocks[1]->medications);
        $this->assertTrue($blocks[1]->quiet);
    }

    public function test_seizure_day_splits_a_run_with_the_same_medications(): void
    {
        $entries = [['id' => 1, 'date' => '27.10.2026', 'time' => '08:15', 'comment' => 'комментарий']];

        $blocks = ReportTimeline::build(
            '2026-10-25',
            '2026-10-28',
            ['2026-10-27' => new SeizurePeriodDay('27.10.2026', $entries)],
            $this->exampleMedications(),
        );

        $this->assertSame(
            ['25.10.2026 - 26.10.2026', '27.10.2026', '28.10.2026'],
            array_map(fn ($block) => $block->label, $blocks),
        );
        $this->assertSame([true, false, true], array_map(fn ($block) => $block->quiet, $blocks));
        $this->assertSame(['Вигабатрин 750мг', 'Карведилол 75мг'], $blocks[1]->medications);
        $this->assertSame($entries, $blocks[1]->entries);
    }

    public function test_single_quiet_day_without_medications(): void
    {
        $blocks = ReportTimeline::build('2026-10-25', '2026-10-25', [], []);

        $this->assertCount(1, $blocks);
        $this->assertSame('25.10.2026', $blocks[0]->label);
        $this->assertSame([], $blocks[0]->medications);
        $this->assertTrue($blocks[0]->quiet);
    }

    public function test_cycle_is_appended_to_the_label_and_kept_on_every_day(): void
    {
        $blocks = ReportTimeline::build('2026-10-25', '2026-10-27', [], [
            $this->medication('Вигабатрин', '750', '2026-10-25', '2026-10-27', 1, 2),
        ]);

        $this->assertCount(1, $blocks);
        $this->assertSame('25.10.2026 - 27.10.2026', $blocks[0]->label);
        $this->assertSame(['Вигабатрин 750мг (приём 1 дн. / перерыв 2 дн.)'], $blocks[0]->medications);
    }

    /**
     * @return list<Medication>
     */
    private function exampleMedications(): array
    {
        return [
            $this->medication('Карведилол', '75', '2026-10-25', '2026-10-28'),
            $this->medication('Вигабатрин', '750', '2026-10-25', '2026-10-28'),
            $this->medication('Вигабатрин', '500', '2026-10-29', null),
        ];
    }

    private function medication(string $name, string $dosage, string $start, ?string $end, int $intakeDays = 1, int $breakDays = 0): Medication
    {
        $medication = new Medication([
            'dosage' => $dosage,
            'unit' => MedicationUnit::Mg,
            'start_date' => $start,
            'end_date' => $end,
            'intake_days' => $intakeDays,
            'break_days' => $breakDays,
        ]);
        $medication->setRelation('medicationName', new MedicationName(['name' => $name]));

        return $medication;
    }
}
