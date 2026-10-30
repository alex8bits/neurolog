<?php

namespace Tests\Unit\Services;

use App\Models\Medication;
use App\Models\User;
use App\Services\MedicationQuery;
use App\Support\MedicationFilters;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Tests\TestCase;

class MedicationQueryTest extends TestCase
{
    use RefreshDatabase;

    private MedicationQuery $query;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Date::setTestNow('2026-10-30 12:00:00');

        $this->query = app(MedicationQuery::class);
        $this->user = User::factory()->create(['timezone' => 'UTC']);
    }

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    public function test_orders_planned_then_active_then_finished_with_per_group_direction(): void
    {
        $finishedEarly = $this->medication('2026-01-01', '2026-03-01');
        $plannedLate = $this->medication('2026-12-01', null);
        $activeOld = $this->medication('2026-05-01', null);
        $finishedLate = $this->medication('2026-02-01', '2026-10-29');
        $plannedSoon = $this->medication('2026-10-31', null);
        $activeRecent = $this->medication('2026-10-30', '2026-10-30');

        $page = $this->query->paginateForUser($this->user, $this->filters(), null, 20);

        $this->assertSame([
            $plannedSoon->id,
            $plannedLate->id,
            $activeRecent->id,
            $activeOld->id,
            $finishedLate->id,
            $finishedEarly->id,
        ], collect($page->items())->pluck('id')->all());
    }

    public function test_search_is_case_insensitive_for_cyrillic_and_escapes_wildcards(): void
    {
        $vigabatrin = $this->medication('2026-10-01', null, 'Вигабатрин');
        $percent = $this->medication('2026-10-01', null, 'Раствор 5%');

        $found = $this->query->paginateForUser($this->user, $this->filters(q: 'вигаб'), null, 20);
        $this->assertSame([$vigabatrin->id], collect($found->items())->pluck('id')->all());

        $wildcard = $this->query->paginateForUser($this->user, $this->filters(q: '%'), null, 20);
        $this->assertSame([$percent->id], collect($wildcard->items())->pluck('id')->all());

        $bang = $this->medication('2026-10-01', null, 'Капли! 1\\2');
        $literal = $this->query->paginateForUser($this->user, $this->filters(q: '! 1\\'), null, 20);
        $this->assertSame([$bang->id], collect($literal->items())->pluck('id')->all());
    }

    public function test_period_keeps_overlapping_intakes(): void
    {
        $openEnded = $this->medication('2026-01-01', null);
        $this->medication('2026-01-01', '2026-05-31');
        $lastDay = $this->medication('2026-02-01', '2026-06-01');

        $overlapping = $this->query->overlapping($this->user, '2026-06-01', '2026-06-30');
        $this->assertEqualsCanonicalizing(
            [$openEnded->id, $lastDay->id],
            $overlapping->pluck('id')->all(),
        );

        $startsAfter = $this->medication('2026-07-01', null);

        $upTo = $this->query->paginateForUser($this->user, $this->filters(to: '2026-06-30'), null, 20);
        $this->assertNotContains($startsAfter->id, collect($upTo->items())->pluck('id')->all());
        $this->assertSame(3, $upTo->total());
    }

    private function medication(string $start, ?string $end, ?string $name = null): Medication
    {
        $factory = Medication::factory()->for($this->user)->between($start, $end);

        return $name === null ? $factory->create() : $factory->create(['name' => $name]);
    }

    private function filters(?string $q = null, ?string $from = null, ?string $to = null): MedicationFilters
    {
        return new MedicationFilters($q, $from, $to, null);
    }
}
