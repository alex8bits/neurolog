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

    public function test_explicit_timezone_overrides_owner_timezone_for_day_grouping(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);

        // 2026-05-10 23:30 UTC is 2026-05-11 02:30 in Moscow, but still the
        // 10th in UTC.
        Seizure::factory()->for($user)->occurredAt('2026-05-10 23:30:00')->create();

        $explicit = new SeizurePeriodReport($user, null, null, $this->query, timezone: 'UTC');
        $this->assertCount(1, $explicit->days);
        $this->assertSame('10.05.2026', $explicit->days[0]->date);

        // Without the parameter the owner's timezone keeps grouping the
        // entry into the 11th (existing semantics).
        $default = new SeizurePeriodReport($user, null, null, $this->query);
        $this->assertCount(1, $default->days);
        $this->assertSame('11.05.2026', $default->days[0]->date);

        // The period bounds are interpreted in the explicit timezone too:
        // 2026-05-10 20:30 UTC is the 10th in UTC, but already 2026-05-11
        // 01:30 in Yekaterinburg (UTC+5).
        $owner = User::factory()->create(['timezone' => 'UTC']);
        Seizure::factory()->for($owner)->occurredAt('2026-05-10 20:30:00')->create();

        // Excluded: the 10th in Yekaterinburg ends at 18:59:59 UTC.
        $yekaterinburg = new SeizurePeriodReport(
            $owner,
            '2026-05-10',
            '2026-05-10',
            $this->query,
            timezone: 'Asia/Yekaterinburg',
        );
        $this->assertSame([], $yekaterinburg->days);
        $this->assertSame(0, $yekaterinburg->totalEntries);

        // Included with the owner's UTC semantics for the same bounds.
        $ownerDefault = new SeizurePeriodReport($owner, '2026-05-10', '2026-05-10', $this->query);
        $this->assertCount(1, $ownerDefault->days);
        $this->assertSame('10.05.2026', $ownerDefault->days[0]->date);

        // And included when the explicit timezone moves the entry into the
        // requested day.
        $yekaterinburgNextDay = new SeizurePeriodReport(
            $owner,
            '2026-05-11',
            '2026-05-11',
            $this->query,
            timezone: 'Asia/Yekaterinburg',
        );
        $this->assertCount(1, $yekaterinburgNextDay->days);
        $this->assertSame('11.05.2026', $yekaterinburgNextDay->days[0]->date);
    }

    public function test_blank_explicit_timezone_falls_back_to_owner_timezone(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);

        // 2026-05-10 23:30 UTC is 2026-05-11 02:30 in Moscow.
        Seizure::factory()->for($user)->occurredAt('2026-05-10 23:30:00')->create();

        foreach (['', '  '] as $blank) {
            $report = new SeizurePeriodReport($user, null, null, $this->query, timezone: $blank);

            $this->assertCount(1, $report->days, "timezone: '{$blank}' should fall back to the owner's timezone");
            $this->assertSame('11.05.2026', $report->days[0]->date, "timezone: '{$blank}' should fall back to the owner's timezone");
        }
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
