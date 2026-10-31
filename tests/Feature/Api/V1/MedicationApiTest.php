<?php

namespace Tests\Feature\Api\V1;

use App\Models\Medication;
use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MedicationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_creates_a_medication(): void
    {
        $this->actingAs(User::factory()->create());

        $response = $this->postJson(route('api.v1.medications.store'), [
            'name' => 'Вигабатрин',
            'dosage' => '750',
            'unit' => 'mg',
            'start_date' => now()->subDays(5)->toDateString(),
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.dosage', '750.00000');
        $response->assertJsonPath('data.name', 'Вигабатрин');
        $this->assertNotNull($response->json('data.medication_name_id'));
        $response->assertJsonPath('data.status', 'active');
        $response->assertJsonPath('data.end_date', null);
    }

    public function test_store_by_name_reuses_the_dictionary_entry_case_insensitively(): void
    {
        $user = User::factory()->create();
        $entry = MedicationName::factory()->for($user)->create(['name' => 'Вигабатрин']);
        $this->actingAs($user);

        $response = $this->postJson(route('api.v1.medications.store'), [
            'name' => 'вигабатрин',
            'dosage' => '750',
            'unit' => 'mg',
            'start_date' => now()->subDays(5)->toDateString(),
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.medication_name_id', $entry->id);
        $this->assertSame(1, MedicationName::count());
    }

    public function test_index_filters_by_status_and_name(): void
    {
        $user = User::factory()->create();
        $match = Medication::factory()->for($user)->planned()->named('Вигабатрин')->create();
        Medication::factory()->for($user)->named('Вигабатрин')->create();
        Medication::factory()->for($user)->planned()->named('Кеппра')->create();
        Medication::factory()->planned()->named('Вигабатрин')->create();
        $this->actingAs($user);

        $response = $this->getJson(route('api.v1.medications.index', [
            'status' => 'planned',
            'q' => 'вигаб',
            'timezone' => 'UTC',
        ]));

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $match->id);
        $response->assertJsonPath('data.0.status', 'planned');
        $response->assertJsonPath('meta.total', 1);
    }

    public function test_update_replaces_the_medication_and_clears_end_date(): void
    {
        $user = User::factory()->create();
        $medication = Medication::factory()->for($user)->finished()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.medications.update', ['medication' => $medication->id]), [
            'name' => 'Депакин',
            'dosage' => 300,
            'unit' => 'mg',
            'start_date' => $medication->start_date->format('Y-m-d'),
            'end_date' => null,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Депакин');
        $response->assertJsonPath('data.end_date', null);
        $response->assertJsonPath('data.status', 'active');
        $this->assertNull($medication->fresh()?->end_date);
    }

    public function test_destroy_soft_deletes_the_medication(): void
    {
        $user = User::factory()->create();
        $medication = Medication::factory()->for($user)->create();
        $this->actingAs($user);

        $this->deleteJson(route('api.v1.medications.destroy', ['medication' => $medication->id]))
            ->assertNoContent();

        $this->assertSoftDeleted($medication);
    }

    public function test_foreign_medication_cannot_be_updated(): void
    {
        $foreign = Medication::factory()->named('Чужое')->create();
        $this->actingAs(User::factory()->create());

        $this->patchJson(route('api.v1.medications.update', ['medication' => $foreign->id]), [
            'name' => 'Взлом',
            'dosage' => '1',
            'unit' => 'mg',
            'start_date' => '2026-01-01',
            'end_date' => null,
        ])->assertNotFound();

        $this->assertSame('Чужое', $foreign->fresh()?->medicationName->name);
    }
}
