<?php

namespace Tests\Unit\Services;

use App\Models\Medication;
use App\Models\MedicationName;
use App\Models\User;
use App\Services\MedicationNameWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MedicationNameWriterTest extends TestCase
{
    use RefreshDatabase;

    public function test_resolve_reuses_an_entry_regardless_of_case_and_spaces(): void
    {
        $user = User::factory()->create();
        $entry = $user->medicationNames()->create(['name' => 'Вигабатрин']);

        $resolved = (new MedicationNameWriter)->resolve($user, ' вигабатрин ');

        $this->assertSame($entry->id, $resolved->id);
        $this->assertSame(1, $user->medicationNames()->count());
        $this->assertSame('Вигабатрин', $entry->fresh()->name);
    }

    public function test_delete_is_refused_while_live_medications_use_the_entry(): void
    {
        $user = User::factory()->create();
        $medication = Medication::factory()->for($user)->named('Кеппра')->create();

        try {
            (new MedicationNameWriter)->delete($user, (string) $medication->medication_name_id);
            $this->fail('Expected ValidationException.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('medication_name', $e->errors());
        }

        $this->assertSame(1, MedicationName::count());
    }

    public function test_delete_removes_the_entry_and_its_trashed_medications(): void
    {
        $user = User::factory()->create();
        $medication = Medication::factory()->for($user)->named('Кеппра')->create();
        $entryId = $medication->medication_name_id;
        $medication->delete();

        (new MedicationNameWriter)->delete($user, (string) $entryId);

        $this->assertSame(0, MedicationName::count());
        $this->assertSame(0, Medication::withTrashed()->count());
    }
}
