<?php

namespace Database\Factories;

use App\Enums\MedicationUnit;
use App\Models\Medication;
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
            'name' => fake()->word(),
            'dosage' => fake()->randomFloat(2, 1, 1000),
            'unit' => MedicationUnit::Mg,
            'start_date' => now()->subDays(10)->toDateString(),
            'end_date' => null,
        ];
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
