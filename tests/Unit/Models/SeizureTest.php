<?php

namespace Tests\Unit\Models;

use App\Models\Seizure;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeizureTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_seizure_owned_by_a_user(): void
    {
        $seizure = Seizure::factory()->create();

        $this->assertNotNull($seizure->user_id);
        $this->assertNotNull($seizure->occurred_at);
        $this->assertNull($seizure->comment);
        $this->assertInstanceOf(User::class, $seizure->user);
        $this->assertSame($seizure->user_id, $seizure->user->id);

        $commented = Seizure::factory()->withComment('сильный приступ')->create();

        $this->assertSame('сильный приступ', $commented->comment);
    }

    public function test_occurred_at_is_cast_to_carbon(): void
    {
        $seizure = Seizure::factory()->occurredAt('2026-05-10 12:15:00')->create();

        $this->assertInstanceOf(CarbonInterface::class, $seizure->occurred_at);
        $this->assertSame('2026-05-10 12:15:00', $seizure->occurred_at->format('Y-m-d H:i:s'));

        $fresh = Seizure::query()->findOrFail($seizure->id);

        $this->assertInstanceOf(CarbonInterface::class, $fresh->occurred_at);
        $this->assertSame('2026-05-10 12:15:00', $fresh->occurred_at->format('Y-m-d H:i:s'));
    }

    public function test_soft_delete_hides_seizure_from_default_query(): void
    {
        $seizure = Seizure::factory()->create();

        $seizure->delete();

        $this->assertSame(0, Seizure::query()->count());
        $this->assertSoftDeleted('seizures', ['id' => $seizure->id]);
        $this->assertSame(1, Seizure::withTrashed()->count());
    }

    public function test_user_seizures_relation_returns_only_own_records(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $own = Seizure::factory()->count(2)->for($user)->create();
        Seizure::factory()->count(3)->for($other)->create();

        $this->assertCount(2, $user->seizures);
        $this->assertEqualsCanonicalizing(
            $own->pluck('id')->all(),
            $user->seizures->pluck('id')->all(),
        );
    }
}
