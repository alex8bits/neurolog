<?php

namespace Tests\Unit\Enums;

use App\Enums\MedicationStatus;
use App\Models\Medication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The status rule lives in two representations (PHP for badges, SQL for
 * filtering/ordering paginated lists); this pins the boundary cases and
 * checks that both sides classify the same records identically.
 */
class MedicationStatusTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-30';

    public function test_php_and_sql_rules_agree_on_boundaries(): void
    {
        $user = User::factory()->create();

        $cases = [
            'starts today' => ['2026-10-30', null, MedicationStatus::Active],
            'ends today' => ['2026-10-01', '2026-10-30', MedicationStatus::Active],
            'ended yesterday' => ['2026-10-01', '2026-10-29', MedicationStatus::Finished],
            'starts tomorrow' => ['2026-10-31', null, MedicationStatus::Planned],
            'open-ended' => ['2026-09-01', null, MedicationStatus::Active],
        ];

        /** @var array<string, list<int>> $expectedIds */
        $expectedIds = [];

        foreach ($cases as $label => [$start, $end, $expected]) {
            $this->assertSame($expected, MedicationStatus::forDates($start, $end, self::TODAY), $label);

            $medication = Medication::factory()->for($user)->between($start, $end)->create();
            $this->assertSame($expected, $medication->status(self::TODAY), $label);

            $expectedIds[$expected->value][] = $medication->id;
        }

        foreach (MedicationStatus::cases() as $status) {
            $query = Medication::query();
            $status->constrain($query, self::TODAY);

            $this->assertEqualsCanonicalizing(
                $expectedIds[$status->value] ?? [],
                $query->pluck('id')->all(),
                $status->value,
            );

            $ranks = Medication::query()
                ->selectRaw(MedicationStatus::rankSql().' as status_rank', [self::TODAY, self::TODAY])
                ->whereIn('id', $expectedIds[$status->value] ?? [])
                ->pluck('status_rank')
                ->map(fn ($rank) => (int) $rank)
                ->unique()
                ->all();

            $this->assertSame([$status->rank()], array_values($ranks), $status->value);
        }
    }
}
