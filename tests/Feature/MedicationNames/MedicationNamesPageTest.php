<?php

namespace Tests\Feature\MedicationNames;

use App\Models\Medication;
use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MedicationNamesPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_lists_own_entries(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $used = MedicationName::factory()->for($user)->create(['name' => 'Депакин']);
        MedicationName::factory()->for($user)->create(['name' => 'Топамакс']);
        MedicationName::factory()->for($other)->create(['name' => 'Чужое']);
        Medication::factory()->for($user)->create(['medication_name_id' => $used->id]);

        $this->actingAs($user)
            ->get(route('medication-names.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('MedicationNames')
                ->has('medicationNames', 2)
                ->where('medicationNames.0.name', 'Депакин')
                ->where('medicationNames.0.medications_count', 1)
                ->where('medicationNames.1.medications_count', 0));
    }

    public function test_user_can_create_rename_and_delete_an_entry(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('medication-names.store'), ['name' => 'Кеппра'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $entry = $user->medicationNames()->firstOrFail();

        $this->actingAs($user)
            ->patch(route('medication-names.update', $entry->id), ['name' => 'Леветирацетам'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame('Леветирацетам', $entry->fresh()->name);

        $this->actingAs($user)
            ->delete(route('medication-names.destroy', $entry->id))
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(0, $user->medicationNames()->count());
    }

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get(route('medication-names.index'))->assertRedirect(route('login'));
    }
}
