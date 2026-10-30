<?php

namespace Tests\Feature\Medications;

use App\Models\Medication;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Inertia\Support\SessionKey;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MedicationsPageTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    public function test_index_lists_own_medications_filtered_by_status(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-12 12:00:00', 'UTC'));

        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        Medication::factory()->for($user)->planned()->create();
        Medication::factory()->for($user)->finished()->create();
        $active = Medication::factory()->for($user)->between('2026-05-01', '2026-06-01')->create([
            'name' => 'Депакин',
            'dosage' => '750',
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('medications.index', ['status' => 'active']));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Medications')
            ->where('filters.status', 'active')
            ->has('medications.data', 1)
            ->where('medications.data.0.id', $active->id)
            ->where('medications.data.0.dosage', '750.00')
            ->where('medications.data.0.dosage_label', '750мг')
            ->where('medications.data.0.start_label', '01.05.2026')
            ->where('medications.data.0.end_date', '2026-06-01')
            ->where('medications.data.0.status', 'active')
            ->has('medications.meta'),
        );
    }

    public function test_user_can_create_a_medication(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from(route('medications.index'))
            ->post(route('medications.store'), [
                'name' => 'Кеппра',
                'dosage' => '2.5',
                'unit' => 'ml',
                'start_date' => '2026-05-01',
                'end_date' => null,
            ]);

        $response->assertRedirect(route('medications.index'));
        $response->assertSessionHas(SessionKey::FLASH_DATA, [
            'toast' => ['type' => 'success', 'message' => 'Медикамент добавлен.'],
        ]);
        $this->assertDatabaseHas('medications', [
            'user_id' => $user->id,
            'name' => 'Кеппра',
            'unit' => 'ml',
            'end_date' => null,
        ]);
    }

    public function test_user_can_update_their_own_medication(): void
    {
        $user = User::factory()->create();
        $medication = Medication::factory()->for($user)->create(['name' => 'Старое']);

        $response = $this
            ->actingAs($user)
            ->from(route('medications.index'))
            ->patch(route('medications.update', $medication), [
                'name' => 'Новое',
                'dosage' => '500',
                'unit' => 'mg',
                'start_date' => '2026-05-01',
                'end_date' => '2026-05-31',
            ]);

        $response->assertRedirect(route('medications.index'));
        $response->assertSessionHas(SessionKey::FLASH_DATA, [
            'toast' => ['type' => 'success', 'message' => 'Медикамент обновлён.'],
        ]);
        $this->assertDatabaseHas('medications', [
            'id' => $medication->id,
            'name' => 'Новое',
            'end_date' => '2026-05-31',
        ]);
    }

    public function test_user_can_soft_delete_their_own_medication(): void
    {
        $user = User::factory()->create();
        $medication = Medication::factory()->for($user)->create();

        $response = $this
            ->actingAs($user)
            ->from(route('medications.index'))
            ->delete(route('medications.destroy', $medication));

        $response->assertRedirect(route('medications.index'));
        $response->assertSessionHas(SessionKey::FLASH_DATA, [
            'toast' => ['type' => 'success', 'message' => 'Медикамент удалён.'],
        ]);
        $this->assertSoftDeleted('medications', ['id' => $medication->id]);
    }
}
