<?php

namespace Tests\Unit\Support;

use App\Models\Medication;
use App\Models\Seizure;
use App\Models\User;
use App\Services\MedicationQuery;
use App\Services\SeizureQuery;
use App\Support\ReportBlock;
use App\Support\SeizurePeriodReport;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Tests\TestCase;

/**
 * The DTO is the single source of truth for the three renderers of slice 4
 * (DOCX, print HTML, Mailable attachment), so the day-boundary grouping and
 * the within-day ordering are exactly the kind of branchy logic that needs
 * a unit test instead of a feature test.
 *
 * "Today" is pinned to 2026-05-20 so open and future-bounded periods end
 * on a known date.
 */
class SeizurePeriodReportTest extends TestCase
{
    use RefreshDatabase;

    private SeizureQuery $query;

    private MedicationQuery $medications;

    protected function setUp(): void
    {
        parent::setUp();

        Date::setTestNow(CarbonImmutable::parse('2026-05-20 12:00:00', 'UTC'));

        $this->query = app(SeizureQuery::class);
        $this->medications = app(MedicationQuery::class);
    }

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    public function test_groups_seizures_by_date_in_owner_timezone(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);

        // 2026-05-09 22:30 UTC is 2026-05-10 01:30 in Moscow.
        Seizure::factory()->for($user)->occurredAt('2026-05-09 22:30:00')->create();
        // 2026-05-10 23:30 UTC is 2026-05-11 02:30 in Moscow.
        Seizure::factory()->for($user)->occurredAt('2026-05-10 23:30:00')->create();

        $report = new SeizurePeriodReport($user, null, null, $this->query, $this->medications);

        // The open period runs from the first seizure up to today.
        $this->assertSame(['10.05.2026', '11.05.2026', '12.05.2026 - 20.05.2026'], $this->labels($report));
        $this->assertSame([false, false, true], array_map(fn (ReportBlock $block) => $block->quiet, $report->days));
        $this->assertSame(2, $report->totalEntries);
    }

    public function test_explicit_timezone_overrides_owner_timezone_for_day_grouping(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);

        // 2026-05-10 23:30 UTC is 2026-05-11 02:30 in Moscow, but still the
        // 10th in UTC.
        Seizure::factory()->for($user)->occurredAt('2026-05-10 23:30:00')->create();

        $explicit = new SeizurePeriodReport($user, null, null, $this->query, $this->medications, timezone: 'UTC');
        $this->assertSame(['10.05.2026', '11.05.2026 - 20.05.2026'], $this->labels($explicit));
        $this->assertCount(1, $explicit->days[0]->entries);

        // Without the parameter the owner's timezone keeps grouping the
        // entry into the 11th (existing semantics).
        $default = new SeizurePeriodReport($user, null, null, $this->query, $this->medications);
        $this->assertSame(['11.05.2026', '12.05.2026 - 20.05.2026'], $this->labels($default));
        $this->assertCount(1, $default->days[0]->entries);

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
            $this->medications,
            timezone: 'Asia/Yekaterinburg',
        );
        $this->assertSame(['10.05.2026'], $this->labels($yekaterinburg));
        $this->assertTrue($yekaterinburg->days[0]->quiet);
        $this->assertSame(0, $yekaterinburg->totalEntries);

        // Included with the owner's UTC semantics for the same bounds.
        $ownerDefault = new SeizurePeriodReport($owner, '2026-05-10', '2026-05-10', $this->query, $this->medications);
        $this->assertSame(['10.05.2026'], $this->labels($ownerDefault));
        $this->assertFalse($ownerDefault->days[0]->quiet);

        // And included when the explicit timezone moves the entry into the
        // requested day.
        $yekaterinburgNextDay = new SeizurePeriodReport(
            $owner,
            '2026-05-11',
            '2026-05-11',
            $this->query,
            $this->medications,
            timezone: 'Asia/Yekaterinburg',
        );
        $this->assertSame(['11.05.2026'], $this->labels($yekaterinburgNextDay));
        $this->assertFalse($yekaterinburgNextDay->days[0]->quiet);
    }

    public function test_blank_explicit_timezone_falls_back_to_owner_timezone(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);

        // 2026-05-10 23:30 UTC is 2026-05-11 02:30 in Moscow.
        Seizure::factory()->for($user)->occurredAt('2026-05-10 23:30:00')->create();

        foreach (['', '  '] as $blank) {
            $report = new SeizurePeriodReport($user, null, null, $this->query, $this->medications, timezone: $blank);

            $this->assertSame('11.05.2026', $report->days[0]->label, "timezone: '{$blank}' should fall back to the owner's timezone");
            $this->assertCount(1, $report->days[0]->entries, "timezone: '{$blank}' should fall back to the owner's timezone");
        }
    }

    public function test_orders_entries_within_a_day_ascending(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        // Same calendar day, but at 18:00, 09:00, 13:00 — assert ASC by time.
        $morning = Seizure::factory()->for($user)->occurredAt('2026-05-10 09:00:00')->create();
        $evening = Seizure::factory()->for($user)->occurredAt('2026-05-10 18:00:00')->create();
        $midday = Seizure::factory()->for($user)->occurredAt('2026-05-10 13:00:00')->create();

        $report = new SeizurePeriodReport($user, '2026-05-10', '2026-05-10', $this->query, $this->medications);

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

    public function test_returns_empty_days_array_for_an_open_period_without_records(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        $report = new SeizurePeriodReport($user, null, null, $this->query, $this->medications);

        $this->assertSame([], $report->days);
        $this->assertSame(0, $report->totalEntries);
    }

    public function test_clips_to_today_and_infers_open_start_from_medication(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);
        Medication::factory()->for($user)->between('2026-05-15', null)->named('Вигабатрин')->create([
            'dosage' => '500',
        ]);
        Seizure::factory()->for($user)->occurredAt('2026-05-17 08:15:00')->create();

        // `to` is past today (2026-05-20); `from` is open.
        $report = new SeizurePeriodReport($user, null, '2026-06-30', $this->query, $this->medications);

        $this->assertSame(
            ['15.05.2026 - 16.05.2026', '17.05.2026', '18.05.2026 - 20.05.2026'],
            $this->labels($report),
        );
        $this->assertSame(['Вигабатрин 500мг'], $report->days[0]->medications);
        $this->assertSame(1, $report->totalEntries);
    }

    /**
     * @return list<string>
     */
    private function labels(SeizurePeriodReport $report): array
    {
        return array_map(fn (ReportBlock $block) => $block->label, $report->days);
    }
}
