<?php

namespace Tests\Feature\Api\V1;

use App\Models\Seizure;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SeizureUpdateApiTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    public function test_owner_can_replace_the_fields_and_gets_the_resource_back(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'));

        $seizure = Seizure::factory()
            ->for(User::factory())
            ->occurredAt('2026-05-01 08:00:00')
            ->withComment('Было плохо')
            ->create();

        $this->actingAs($seizure->user);

        // PUT semantics: both fields always travel; a naive moment is judged
        // and stored in the submitted timezone.
        $response = $this->patchJson(route('api.v1.seizures.update', ['seizure' => $seizure->id]), [
            'occurred_at' => '2026-05-10 09:15:00',
            'comment' => 'Стало лучше',
            'timezone' => 'Europe/Moscow',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.id', $seizure->id);
        $response->assertJsonPath('data.occurred_at', '2026-05-10T06:15:00.000000Z');
        $response->assertJsonPath('data.comment', 'Стало лучше');
        $response->assertJsonMissingPath('data.user_id');
        $response->assertJsonMissingPath('data.deleted_at');

        $this->assertDatabaseHas('seizures', [
            'id' => $seizure->id,
            'occurred_at' => '2026-05-10 06:15:00',
            'comment' => 'Стало лучше',
        ]);
    }

    public function test_an_absent_moment_resolves_to_the_current_utc_moment(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'));

        $seizure = Seizure::factory()
            ->for(User::factory())
            ->occurredAt('2026-05-01 08:00:00')
            ->withComment('Старый комментарий')
            ->create();

        $this->actingAs($seizure->user);

        $response = $this->patchJson(route('api.v1.seizures.update', ['seizure' => $seizure->id]), [
            'comment' => null,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.occurred_at', '2026-05-10T09:15:00.000000Z');
        $response->assertJsonPath('data.comment', null);

        $this->assertDatabaseHas('seizures', [
            'id' => $seizure->id,
            'occurred_at' => '2026-05-10 09:15:00',
            'comment' => null,
        ]);
    }

    public function test_a_null_comment_clears_a_stored_comment(): void
    {
        $seizure = Seizure::factory()
            ->for(User::factory())
            ->withComment('Старый комментарий')
            ->create();

        $this->actingAs($seizure->user);

        $response = $this->patchJson(route('api.v1.seizures.update', ['seizure' => $seizure->id]), [
            'occurred_at' => '2026-05-10T06:00:00+00:00',
            'comment' => null,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.comment', null);
        $this->assertDatabaseHas('seizures', ['id' => $seizure->id, 'comment' => null]);
    }

    public function test_a_moment_later_than_five_minutes_into_the_future_is_rejected(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'));

        $seizure = Seizure::factory()
            ->for(User::factory())
            ->occurredAt('2026-05-01 08:00:00')
            ->create();

        $this->actingAs($seizure->user);

        // Six minutes ahead once the Moscow offset is applied.
        $response = $this->patchJson(route('api.v1.seizures.update', ['seizure' => $seizure->id]), [
            'occurred_at' => '2026-05-10 12:21:00',
            'comment' => null,
            'timezone' => 'Europe/Moscow',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('occurred_at');

        // The rejected moment must not have replaced the stored one.
        $this->assertDatabaseHas('seizures', [
            'id' => $seizure->id,
            'occurred_at' => '2026-05-01 08:00:00',
        ]);
    }

    public function test_an_overly_long_comment_is_rejected(): void
    {
        $seizure = Seizure::factory()->for(User::factory())->create();

        $this->actingAs($seizure->user);

        $response = $this->patchJson(route('api.v1.seizures.update', ['seizure' => $seizure->id]), [
            'occurred_at' => '2026-05-10 06:00:00+00:00',
            'comment' => str_repeat('а', 2001),
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('comment');
    }

    public function test_a_seizure_of_another_user_yields_a_not_found(): void
    {
        $seizure = Seizure::factory()
            ->for(User::factory())
            ->withComment('Чужая запись')
            ->create();

        $this->actingAs(User::factory()->create());

        $this->patchJson(route('api.v1.seizures.update', ['seizure' => $seizure->id]), [
            'occurred_at' => '2026-05-10 06:00:00+00:00',
            'comment' => 'Перехвачено',
        ])->assertNotFound();

        $this->assertDatabaseHas('seizures', ['id' => $seizure->id, 'comment' => 'Чужая запись']);
    }

    public function test_a_missing_seizure_yields_a_not_found(): void
    {
        $this->actingAs(User::factory()->create());

        $this->patchJson(route('api.v1.seizures.update', ['seizure' => 1]), [
            'occurred_at' => '2026-05-10 06:00:00+00:00',
            'comment' => null,
        ])->assertNotFound();
    }

    public function test_a_soft_deleted_seizure_yields_a_not_found(): void
    {
        $seizure = Seizure::factory()->for(User::factory())->create();
        $seizure->delete();

        $this->actingAs($seizure->user);

        $this->patchJson(route('api.v1.seizures.update', ['seizure' => $seizure->id]), [
            'occurred_at' => '2026-05-10 06:00:00+00:00',
            'comment' => null,
        ])->assertNotFound();
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
    public function test_updating_an_unresolvable_id_yields_a_not_found(string $id): void
    {
        $this->actingAs(User::factory()->create());

        $this->patchJson('/api/v1/seizures/'.$id, [
            'occurred_at' => '2026-05-10 06:00:00+00:00',
            'comment' => null,
        ])->assertNotFound();
    }

    public function test_guests_cannot_update_seizures(): void
    {
        $this->patchJson(route('api.v1.seizures.update', ['seizure' => 1]), [
            'occurred_at' => '2026-05-10 06:00:00+00:00',
            'comment' => null,
        ])->assertUnauthorized();
    }
}
