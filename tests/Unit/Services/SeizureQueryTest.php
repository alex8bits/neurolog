<?php

namespace Tests\Unit\Services;

use App\Models\Seizure;
use App\Models\User;
use App\Services\SeizureQuery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeizureQueryTest extends TestCase
{
    use RefreshDatabase;

    private SeizureQuery $query;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->query = app(SeizureQuery::class);
        $this->user = User::factory()->create();
    }

    public function test_without_filters_returns_all_own_seizures(): void
    {
        Seizure::factory()->count(3)->for($this->user)->create();

        $page = $this->query->paginateForPeriod($this->user);

        $this->assertSame(3, $page->total());
        $this->assertCount(3, $page->items());
    }

    public function test_other_users_seizures_are_never_returned(): void
    {
        $other = User::factory()->create();

        $own = Seizure::factory()->for($this->user)->occurredAt('2026-05-10 12:00:00')->create();
        Seizure::factory()->for($other)->occurredAt('2026-05-10 12:00:00')->create();

        $all = $this->query->paginateForPeriod($this->user);

        $this->assertSame([$own->id], collect($all->items())->pluck('id')->all());

        $filtered = $this->query->paginateForPeriod($this->user, '2026-05-10', '2026-05-10');

        $this->assertSame([$own->id], collect($filtered->items())->pluck('id')->all());
    }

    public function test_from_boundary_includes_the_whole_first_day(): void
    {
        $included = Seizure::factory()->for($this->user)->occurredAt('2026-05-10 00:00:00')->create();
        Seizure::factory()->for($this->user)->occurredAt('2026-05-09 23:59:00')->create();

        $page = $this->query->paginateForPeriod($this->user, '2026-05-10');

        $this->assertSame([$included->id], collect($page->items())->pluck('id')->all());
    }

    public function test_to_boundary_includes_the_whole_last_day(): void
    {
        $included = Seizure::factory()->for($this->user)->occurredAt('2026-05-10 23:59:59')->create();
        Seizure::factory()->for($this->user)->occurredAt('2026-05-11 00:00:00')->create();

        $page = $this->query->paginateForPeriod($this->user, null, '2026-05-10');

        $this->assertSame([$included->id], collect($page->items())->pluck('id')->all());
    }

    public function test_boundaries_are_interpreted_in_requested_timezone(): void
    {
        // 2026-05-09 22:30 UTC is already 2026-05-10 01:30 in Moscow.
        $seizure = Seizure::factory()->for($this->user)->occurredAt('2026-05-09 22:30:00')->create();

        $inMoscow = $this->query->paginateForPeriod($this->user, '2026-05-10', null, 'Europe/Moscow');

        $this->assertSame([$seizure->id], collect($inMoscow->items())->pluck('id')->all());

        $inUtc = $this->query->paginateForPeriod($this->user, '2026-05-10');

        $this->assertSame(0, $inUtc->total());
    }

    public function test_soft_deleted_seizures_are_excluded(): void
    {
        $kept = Seizure::factory()->for($this->user)->occurredAt('2026-05-10 10:00:00')->create();
        $trashed = Seizure::factory()->for($this->user)->occurredAt('2026-05-10 11:00:00')->create();

        $trashed->delete();

        $page = $this->query->paginateForPeriod($this->user, '2026-05-10', '2026-05-10');

        $this->assertSame([$kept->id], collect($page->items())->pluck('id')->all());
    }

    public function test_results_are_sorted_by_occurred_at_desc(): void
    {
        $oldest = Seizure::factory()->for($this->user)->occurredAt('2026-05-08 09:00:00')->create();
        $newest = Seizure::factory()->for($this->user)->occurredAt('2026-05-10 09:00:00')->create();
        $middle = Seizure::factory()->for($this->user)->occurredAt('2026-05-09 09:00:00')->create();

        $page = $this->query->paginateForPeriod($this->user);

        $this->assertSame(
            [$newest->id, $middle->id, $oldest->id],
            collect($page->items())->pluck('id')->all(),
        );
    }

    public function test_per_page_limits_page_size(): void
    {
        Seizure::factory()->count(5)->for($this->user)->create();

        $page = $this->query->paginateForPeriod($this->user, perPage: 2);

        $this->assertCount(2, $page->items());
        $this->assertSame(2, $page->perPage());
        $this->assertSame(5, $page->total());
    }
}
