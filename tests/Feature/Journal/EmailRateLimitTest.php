<?php

namespace Tests\Feature\Journal;

use App\Mail\JournalReport;
use App\Models\Seizure;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Outbound mail is capped by `throttle:5,1` on both email actions (the same
 * budget the API password endpoints use). The limiter keys by the
 * authenticated user id alone — not by route — so the two actions share one
 * budget of five sends per minute.
 */
class EmailRateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_email_actions_are_rate_limited_per_user(): void
    {
        Mail::fake();
        $user = User::factory()->create();
        Seizure::factory()->for($user)->create();

        // Five sends fit the budget…
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($user)
                ->from(route('dashboard'))
                ->post(route('seizures.email-self'))
                ->assertRedirect(route('dashboard'));
        }

        // …the sixth is rejected with 429…
        $this->actingAs($user)
            ->post(route('seizures.email-self'))
            ->assertStatus(429);

        // …and the budget is shared with the doctor action.
        $this->actingAs($user)
            ->post(route('seizures.email-doctor'), [
                'to' => 'doctor@example.com',
            ])
            ->assertStatus(429);

        Mail::assertSent(JournalReport::class, 5);
    }
}
