<?php

namespace Tests\Unit\Services;

use App\Models\Seizure;
use App\Models\User;
use App\Services\SeizureSummaryBuilder;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Tests\TestCase;

class SeizureSummaryBuilderTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    public function test_utc_evening_record_lands_on_next_local_day(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-10-19 10:00:00', 'UTC'));
        $user = User::factory()->create();
        Seizure::factory()->for($user)->occurredAt('2026-10-17 23:30:00')->create();

        $summary = app(SeizureSummaryBuilder::class)->build($user, null, null, 'Europe/Moscow');

        $byDate = array_column($summary->days, 'count', 'date');
        $this->assertSame(0, $byDate['2026-10-17']);
        $this->assertSame(1, $byDate['2026-10-18']);
    }

    public function test_days_are_zero_filled_and_period_counts_unique_days(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-10-19 10:00:00', 'UTC'));
        $user = User::factory()->create();
        Seizure::factory()->for($user)->occurredAt('2026-10-19 08:00:00')->create();
        Seizure::factory()->for($user)->occurredAt('2026-10-19 09:00:00')->create();
        Seizure::factory()->for($user)->occurredAt('2026-08-01 09:00:00')->create();

        $summary = app(SeizureSummaryBuilder::class)->build($user, null, null, 'UTC');

        $this->assertCount(30, $summary->days);
        $this->assertSame('2026-09-20', $summary->days[0]['date']);
        $this->assertSame('2026-10-19', $summary->days[29]['date']);
        $this->assertSame($summary->today, $summary->days[29]['date']);
        $this->assertSame(2, $summary->days[29]['count']);
        $this->assertSame(3, $summary->period['total']);
        $this->assertSame(2, $summary->period['days_with_seizures']);
    }
}
