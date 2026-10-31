<?php

namespace Database\Factories;

use App\Enums\MedicationUnit;
use App\Models\Medication;
use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Medication>
 */
class MedicationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'medication_name_id' => fn (array $attributes) => MedicationName::factory()->create(['user_id' => $attributes['user_id']])->id,
            'dosage' => fake()->randomFloat(5, 1, 1000),
            'unit' => MedicationUnit::Mg,
            'start_date' => now()->subDays(10)->toDateString(),
            'end_date' => null,
        ];
    }

    /**
     * Attach the intake to the owner's dictionary entry with this name (created on first use).
     */
    public function named(string $name): static
    {
        return $this->state(fn (array $attributes) => [
            // user_id/name_search не fillable, поэтому не firstOrCreate: ищем по ключу, иначе forceCreate.
            'medication_name_id' => fn (array $attributes) => (MedicationName::query()
                ->where('user_id', $attributes['user_id'])
                ->where('name_search', MedicationName::fold($name))
                ->first()
                ?? MedicationName::query()->forceCreate(['user_id' => $attributes['user_id'], 'name' => $name])
            )->id,
        ]);
    }

    /**
     * Indicate that the intake starts in the future.
     */
    public function planned(): static
    {
        return $this->between(now()->addDays(5)->toDateString(), null);
    }

    /**
     * Indicate that the intake has already ended.
     */
    public function finished(): static
    {
        return $this->between(now()->subDays(30)->toDateString(), now()->subDays(2)->toDateString());
    }

    /**
     * Indicate that the intake runs between the given Y-m-d dates (end inclusive).
     */
    public function between(string $start, ?string $end): static
    {
        return $this->state(fn (array $attributes) => [
            'start_date' => $start,
            'end_date' => $end,
        ]);
    }
}
