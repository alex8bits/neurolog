<?php

namespace Tests\Feature\Journal;

use App\Models\Seizure;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Support\SessionKey;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class JournalTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_lists_only_own_seizures_formatted_in_the_owners_timezone(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        $own = Seizure::factory()
            ->for($user)
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->withComment('Свой приступ')
            ->create();
        // Чужая запись того же дня создаётся, чтобы убедиться, что индекс
        // отдаёт только свои.
        Seizure::factory()
            ->for(User::factory())
            ->withComment('Чужой приступ')
            ->create();

        $response = $this
            ->actingAs($user)
            ->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Journal')
            ->where('filters.from', null)
            ->where('filters.to', null)
            ->has('seizures.data', 1)
            ->where('seizures.data.0.id', $own->id)
            ->where('seizures.data.0.date', '10.05.2026')
            ->where('seizures.data.0.time', '12:15')
            ->where('seizures.data.0.comment', 'Свой приступ')
            ->where('seizures.data.0.occurred_at_local', '2026-05-10T12:15')
            ->missing('seizures.data.0.user_id')
            ->missing('seizures.data.0.deleted_at'),
        );
    }

    public function test_user_can_update_their_own_seizure(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        $seizure = Seizure::factory()
            ->for($user)
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->create();

        $response = $this
            ->actingAs($user)
            ->from(route('dashboard'))
            ->patch(route('seizures.update', $seizure), [
                'occurred_at' => '2026-05-10 13:30:00',
                'comment' => 'Обновлённый комментарий',
            ]);

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHas(SessionKey::FLASH_DATA, [
            'toast' => [
                'type' => 'success',
                'message' => 'Запись обновлена.',
            ],
        ]);

        $seizure->refresh();
        $this->assertSame('Обновлённый комментарий', $seizure->comment);
        // 13:30 в Москве — это 10:30 UTC, исходные 09:15 UTC перезаписаны.
        $this->assertTrue(
            $seizure->occurred_at->equalTo(CarbonImmutable::parse('2026-05-10 10:30:00', 'UTC')),
            'occurred_at должен быть перенормализован в UTC по поясу профиля.',
        );
    }

    public function test_user_can_soft_delete_their_own_seizure(): void
    {
        $user = User::factory()->create();
        $seizure = Seizure::factory()->for($user)->create();

        $response = $this
            ->actingAs($user)
            ->from(route('dashboard'))
            ->delete(route('seizures.destroy', $seizure));

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHas(SessionKey::FLASH_DATA, [
            'toast' => [
                'type' => 'success',
                'message' => 'Запись удалена.',
            ],
        ]);

        $this->assertSoftDeleted('seizures', ['id' => $seizure->id]);
    }

    public function test_user_cannot_touch_another_users_seizure(): void
    {
        $user = User::factory()->create();
        $other = Seizure::factory()
            ->for(User::factory())
            ->withComment('Оригинальный')
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->create();

        $this->actingAs($user)
            ->patch(route('seizures.update', $other), [
                'occurred_at' => '2026-05-10 13:30:00',
                'comment' => 'Попытка перезаписи',
            ])
            ->assertNotFound();

        $this->actingAs($user)
            ->delete(route('seizures.destroy', $other))
            ->assertNotFound();

        $this->assertDatabaseHas('seizures', [
            'id' => $other->id,
            'comment' => 'Оригинальный',
            'deleted_at' => null,
        ]);
    }

    public function test_user_can_create_a_seizure_from_the_dashboard(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);

        $response = $this
            ->actingAs($user)
            ->from(route('dashboard'))
            ->post(route('seizures.store'), [
                'occurred_at' => '2026-05-10T12:15',
                'comment' => 'Запись из теста',
            ]);

        $response->assertRedirect(route('dashboard'));

        $this->assertDatabaseHas('seizures', [
            'user_id' => $user->id,
            'comment' => 'Запись из теста',
            // 12:15 в Europe/Moscow (UTC+3 в мае) = 09:15 UTC.
            'occurred_at' => '2026-05-10 09:15:00',
        ]);

        $response->assertSessionHas(SessionKey::FLASH_DATA, [
            'toast' => [
                'type' => 'success',
                'message' => 'Запись добавлена.',
            ],
        ]);

        // Inertia-редирект после POST не несёт тела страницы — `assertInertia`
        // применим только к ответу с view. Дёргаем `/dashboard` повторно и
        // проверяем, что новая запись уже в таблице (это и есть «без перезагрузки»:
        // Inertia SPA делает тот же GET, что и здесь).
        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Journal')
                ->where('seizures.data.0.comment', 'Запись из теста')
                ->where('seizures.data.0.date', '10.05.2026')
                ->where('seizures.data.0.time', '12:15')
                ->etc());
    }

    public function test_store_defaults_occurred_at_to_now_when_missing(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        $before = now('UTC')->subSeconds(2);
        $response = $this
            ->actingAs($user)
            ->from(route('dashboard'))
            ->post(route('seizures.store'), [
                // 'occurred_at' намеренно отсутствует — writer должен подставить now('UTC').
                'comment' => 'Без даты',
            ]);
        $after = now('UTC')->addSeconds(2);

        $response->assertRedirect(route('dashboard'));

        $this->assertDatabaseHas('seizures', [
            'user_id' => $user->id,
            'comment' => 'Без даты',
        ]);

        $seizure = Seizure::firstWhere('comment', 'Без даты');
        $this->assertTrue(
            $seizure->occurred_at->between($before, $after),
            'occurred_at должен попасть в окно вокруг now() UTC (±2 секунды).',
        );
    }
}
