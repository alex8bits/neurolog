<?php

namespace Tests\Feature\Api\V1;

use App\Models\Seizure;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SeizureApiTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    public function test_user_can_store_and_list_and_delete_own_seizure(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $stored = $this->postJson(route('api.v1.seizures.store'), [
            'comment' => 'Сильный приступ',
        ]);

        $stored->assertCreated();
        $stored->assertJsonPath('data.comment', 'Сильный приступ');

        $id = $stored->json('data.id');

        $listed = $this->getJson(route('api.v1.seizures.index'));

        $listed->assertOk();
        $listed->assertJsonCount(1, 'data');
        $listed->assertJsonStructure([
            'data' => [
                ['id', 'occurred_at', 'comment', 'created_at'],
            ],
            'meta',
            'links',
        ]);
        $listed->assertJsonPath('data.0.id', $id);
        $listed->assertJsonMissingPath('data.0.user_id');
        $listed->assertJsonMissingPath('data.0.deleted_at');

        $deleted = $this->deleteJson(route('api.v1.seizures.destroy', ['seizure' => $id]));

        $deleted->assertNoContent();
        $this->assertSoftDeleted('seizures', ['id' => $id]);

        // A soft deleted record is gone for good as far as the API is concerned.
        $this->deleteJson(route('api.v1.seizures.destroy', ['seizure' => $id]))->assertNotFound();
        $this->getJson(route('api.v1.seizures.index'))->assertJsonCount(0, 'data');
    }

    public function test_store_without_a_payload_records_the_current_utc_moment(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'));

        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson(route('api.v1.seizures.store'), []);

        $response->assertCreated();
        $response->assertJsonPath('data.occurred_at', '2026-05-10T09:15:00.000000Z');
        $response->assertJsonPath('data.comment', null);
    }

    /**
     * The unit tests build the validator by hand, so they cannot notice if the
     * HTTP pipeline ever stopped calling `withValidator()`. This one goes
     * through the real pipeline: a naive "right now" Moscow moment must be
     * judged in Europe/Moscow (201), not in the application timezone (422).
     */
    public function test_store_accepts_a_naive_moment_paired_with_a_timezone(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'));

        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson(route('api.v1.seizures.store'), [
            'occurred_at' => '2026-05-10 12:15:00',
            'timezone' => 'Europe/Moscow',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.occurred_at', '2026-05-10T09:15:00.000000Z');
    }

    public function test_user_cannot_delete_another_users_seizure(): void
    {
        $user = User::factory()->create();
        $other = Seizure::factory()->for(User::factory())->create();

        $this->actingAs($user);

        $this->deleteJson(route('api.v1.seizures.destroy', ['seizure' => $other->id]))
            ->assertNotFound();

        $this->assertDatabaseHas('seizures', ['id' => $other->id, 'deleted_at' => null]);
    }

    /**
     * The `whereNumber('seizure')` constraint and the string typed controller
     * parameter carry this together: a non numeric id must never reach the
     * route, and a digits-only id beyond `PHP_INT_MAX` must not become a
     * `TypeError` (500) on the way in. Both have to answer 404.
     *
     * @return array<string, array{string}>
     */
    public static function unresolvableSeizureIds(): array
    {
        return [
            'non numeric id' => ['abc'],
            'id beyond PHP_INT_MAX' => ['99999999999999999999'],
        ];
    }

    #[DataProvider('unresolvableSeizureIds')]
    public function test_deleting_an_unresolvable_id_yields_a_not_found(string $id): void
    {
        $this->actingAs(User::factory()->create());

        $this->deleteJson('/api/v1/seizures/'.$id)->assertNotFound();
    }

    public function test_timestamps_are_serialized_as_iso_8601_utc(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'));

        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson(route('api.v1.seizures.store'), [
            'occurred_at' => '2026-05-10T12:00:00+03:00',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.occurred_at', '2026-05-10T09:00:00.000000Z');
        $response->assertJsonPath('data.created_at', '2026-05-10T09:15:00.000000Z');
    }

    public function test_index_returns_only_own_seizures(): void
    {
        $user = User::factory()->create();
        $mine = Seizure::factory()->for($user)->create();
        $theirs = Seizure::factory()->for(User::factory())->create();

        $this->actingAs($user);

        $response = $this->getJson(route('api.v1.seizures.index'));

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $mine->id);
        $response->assertJsonMissing(['id' => $theirs->id]);
    }
}
