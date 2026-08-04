<?php

namespace Tests\Unit\Support;

use App\Models\Seizure;
use App\Models\User;
use App\Services\SeizureQuery;
use App\Support\SeizurePeriodReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The DTO is the single source of truth for the three renderers of slice 4
 * (DOCX, print HTML, Mailable attachment), so the day-boundary grouping and
 * the within-day ordering are exactly the kind of branchy logic that needs
 * a unit test instead of a feature test.
 */
class SeizurePeriodReportTest extends TestCase
{
    use RefreshDatabase;

    private SeizureQuery $query;

    protected function setUp(): void
    {
        parent::setUp();

        $this->query = app(SeizureQuery::class);
    }

    public function test_groups_seizures_by_date_in_owner_timezone(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);

        // 2026-05-09 22:30 UTC is 2026-05-10 01:30 in Moscow.
        Seizure::factory()->for($user)->occurredAt('2026-05-09 22:30:00')->create();
        // 2026-05-10 23:30 UTC is 2026-05-11 02:30 in Moscow.
        Seizure::factory()->for($user)->occurredAt('2026-05-10 23:30:00')->create();

        $report = new SeizurePeriodReport($user, null, null, $this->query);

        $this->assertCount(2, $report->days);
        $this->assertSame('10.05.2026', $report->days[0]->date);
        $this->assertSame('11.05.2026', $report->days[1]->date);
        $this->assertSame(2, $report->totalEntries);
    }

    public function test_orders_entries_within_a_day_ascending(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        // Same calendar day, but at 18:00, 09:00, 13:00 — assert ASC by time.
        $morning = Seizure::factory()->for($user)->occurredAt('2026-05-10 09:00:00')->create();
        $evening = Seizure::factory()->for($user)->occurredAt('2026-05-10 18:00:00')->create();
        $midday = Seizure::factory()->for($user)->occurredAt('2026-05-10 13:00:00')->create();

        $report = new SeizurePeriodReport($user, '2026-05-10', '2026-05-10', $this->query);

        $this->assertCount(1, $report->days);
        $this->assertCount(3, $report->days[0]->entries);
        $this->assertSame('09:00', $report->days[0]->entries[0]['time']);
        $this->assertSame('13:00', $report->days[0]->entries[1]['time']);
        $this->assertSame('18:00', $report->days[0]->entries[2]['time']);
        $this->assertSame([$morning->id, $midday->id, $evening->id], [
            $report->days[0]->entries[0]['id'],
            $report->days[0]->entries[1]['id'],
            $report->days[0]->entries[2]['id'],
        ]);
    }

    public function test_returns_empty_days_array_when_no_seizures_in_period(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        $report = new SeizurePeriodReport($user, '2026-05-10', '2026-05-10', $this->query);

        $this->assertSame([], $report->days);
        $this->assertSame(0, $report->totalEntries);
    }
}
