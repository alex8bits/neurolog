<?php

namespace Database\Factories;

use App\Models\Seizure;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Seizure>
 */
class SeizureFactory extends Factory
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
            'occurred_at' => fake()->dateTimeBetween('-30 days', 'now', 'UTC'),
            'comment' => null,
        ];
    }

    /**
     * Indicate that the seizure has a comment.
     */
    public function withComment(?string $comment = null): static
    {
        return $this->state(fn (array $attributes) => [
            'comment' => $comment ?? fake()->sentence(),
        ]);
    }

    /**
     * Indicate that the seizure happened at the given moment.
     */
    public function occurredAt(CarbonInterface|string $moment): static
    {
        return $this->state(fn (array $attributes) => [
            'occurred_at' => $moment,
        ]);
    }
}
