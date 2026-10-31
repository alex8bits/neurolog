<?php

namespace Tests\Feature\Api\V1;

use App\Models\Medication;
use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MedicationNameApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_lists_own_entries_with_usage_count(): void
    {
        $user = User::factory()->create();
        Medication::factory()->for($user)->named('Кеппра')->create();
        MedicationName::factory()->for($user)->create(['name' => 'Depakine']);
        MedicationName::factory()->create(['name' => 'Чужое']);
        $this->actingAs($user);

        $response = $this->getJson(route('api.v1.medication-names.index'));

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('data.0.name', 'Depakine');
        $response->assertJsonPath('data.0.medications_count', 0);
        $response->assertJsonPath('data.1.name', 'Кеппра');
        $response->assertJsonPath('data.1.medications_count', 1);
    }

    public function test_store_creates_an_entry(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson(route('api.v1.medication-names.store'), ['name' => 'Вигабатрин']);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'Вигабатрин');
        $this->assertSame(1, $user->medicationNames()->count());
    }

    public function test_update_renames_an_entry(): void
    {
        $user = User::factory()->create();
        $entry = MedicationName::factory()->for($user)->create(['name' => 'Старое']);
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.medication-names.update', ['medicationName' => $entry->id]), ['name' => 'Новое']);

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Новое');
    }

    public function test_destroy_deletes_an_unused_entry(): void
    {
        $user = User::factory()->create();
        $entry = MedicationName::factory()->for($user)->create();
        $this->actingAs($user);

        $this->deleteJson(route('api.v1.medication-names.destroy', ['medicationName' => $entry->id]))->assertNoContent();

        $this->assertSame(0, $user->medicationNames()->count());
    }
}
