<?php

namespace Tests\Feature\Api\V1\Profile;

use App\Models\Seizure;
use App\Models\User;
use App\Services\TokenService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_endpoints_reject_guests(): void
    {
        $this->getJson(route('api.v1.profile.show'))->assertUnauthorized();
        $this->patchJson(route('api.v1.profile.update'), [])->assertUnauthorized();
        $this->patchJson(route('api.v1.profile.password.update'), [])->assertUnauthorized();
        $this->deleteJson(route('api.v1.profile.destroy'), [])->assertUnauthorized();
    }

    public function test_show_returns_the_profile_with_the_timezone_groups(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        $this->actingAs($user);

        $response = $this->getJson(route('api.v1.profile.show'));

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => ['id', 'name', 'email', 'timezone'],
            'timezones',
        ]);

        // The exact key set is part of the contract: a new model column must
        // not silently reach (or break) the mobile client.
        $this->assertSame(['id', 'name', 'email', 'timezone'], array_keys($response->json('data')));

        $response->assertJsonPath('data.id', $user->id);
        $response->assertJsonPath('data.name', $user->name);
        $response->assertJsonPath('data.email', $user->email);
        $response->assertJsonPath('data.timezone', 'Europe/Moscow');
        $response->assertJsonMissingPath('data.password');
        $response->assertJsonMissingPath('data.email_verified_at');

        // The selector options ride along in the same grouped shape the web
        // page gets from Timezones::grouped().
        foreach ($response->json('timezones') as $group) {
            $this->assertSame(['region', 'zones'], array_keys($group));
        }

        $europe = collect($response->json('timezones'))
            ->first(fn (array $group) => $group['region'] === 'Europe');

        $this->assertIsArray($europe);
        $this->assertContains('Europe/Moscow', $europe['zones']);
    }

    public function test_update_saves_the_profile_fields(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.update'), [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'timezone' => 'Asia/Novosibirsk',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.name', 'Jane Doe');
        $response->assertJsonPath('data.email', 'jane@example.com');
        $response->assertJsonPath('data.timezone', 'Asia/Novosibirsk');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'timezone' => 'Asia/Novosibirsk',
        ]);
    }

    public function test_update_resets_email_verification_when_the_email_changes(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.update'), [
            'name' => $user->name,
            'email' => 'brand-new@example.com',
            'timezone' => 'UTC',
        ]);

        $response->assertOk();
        $this->assertNull($user->refresh()->email_verified_at);
    }

    public function test_update_keeps_email_verification_when_the_email_stays_the_same(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.update'), [
            'name' => 'Renamed Person',
            'email' => $user->email,
            'timezone' => 'UTC',
        ]);

        $response->assertOk();
        $this->assertNotNull($user->refresh()->email_verified_at);
    }

    public function test_update_rejects_an_empty_name(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.update'), [
            'name' => '',
            'email' => $user->email,
            'timezone' => 'UTC',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('name');
    }

    public function test_update_rejects_an_email_owned_by_another_user(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.update'), [
            'name' => $user->name,
            'email' => $other->email,
            'timezone' => 'UTC',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('email');
    }

    public function test_update_rejects_an_unknown_timezone(): void
    {
        // Non-UTC start: the assert below then proves the value was left
        // untouched by the 422, not merely equal to the factory default.
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.update'), [
            'name' => $user->name,
            'email' => $user->email,
            'timezone' => 'Not/AZone',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('timezone');
        $this->assertDatabaseHas('users', ['id' => $user->id, 'timezone' => 'Europe/Moscow']);
    }

    /**
     * The validation rule is nullable (the trait is shared with registration)
     * while the column is NOT NULL, so the controller must coalesce every
     * blank shape to UTC instead of failing the insert.
     *
     * @return array<string, array{array<string, mixed>}>
     */
    public static function blankTimezonePayloads(): array
    {
        $base = ['name' => 'Jane Doe', 'email' => 'jane@example.com'];

        return [
            'timezone absent' => [$base],
            'timezone null' => [$base + ['timezone' => null]],
            'timezone empty string' => [$base + ['timezone' => '']],
        ];
    }

    #[DataProvider('blankTimezonePayloads')]
    public function test_update_falls_back_to_utc_when_the_timezone_is_blank(array $payload): void
    {
        // Non-UTC start: the UTC in the asserts is then the written
        // coalesced value, not the factory default the update skipped.
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.update'), $payload);

        $response->assertOk();
        $response->assertJsonPath('data.timezone', 'UTC');
        $this->assertDatabaseHas('users', ['id' => $user->id, 'timezone' => 'UTC']);
    }

    public function test_password_update_changes_the_password(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.password.update'), [
            'current_password' => 'password',
            'password' => 'new-strong-password',
            'password_confirmation' => 'new-strong-password',
        ]);

        $response->assertNoContent();
        $this->assertTrue(Hash::check('new-strong-password', $user->refresh()->password));
        $this->assertFalse(Hash::check('password', $user->refresh()->password));
    }

    public function test_password_update_rejects_a_wrong_current_password(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->patchJson(route('api.v1.profile.password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'new-strong-password',
            'password_confirmation' => 'new-strong-password',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('current_password');
        $this->assertTrue(Hash::check('password', $user->refresh()->password));
    }

    public function test_delete_rejects_a_wrong_password(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->deleteJson(route('api.v1.profile.destroy'), [
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('password');
        $this->assertNotNull($user->fresh());
    }

    public function test_delete_removes_the_user_with_their_seizures_and_tokens(): void
    {
        $user = User::factory()->create();
        app(TokenService::class)->issueTokens($user);
        Seizure::factory()->for($user)->create();

        $this->actingAs($user);

        $response = $this->deleteJson(route('api.v1.profile.destroy'), [
            'password' => 'password',
        ]);

        $response->assertNoContent();
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('seizures', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'tokenable_type' => User::class,
        ]);
        $this->assertDatabaseMissing('refresh_tokens', ['user_id' => $user->id]);
    }

    /**
     * `throttle:6,1` shields the password check: six wrong attempts reach the
     * validation (422), the seventh is bounced by the limiter (429) and the
     * account survives. The limiter key is the sha1 of the user id — fresh
     * with the per-test array cache, but cleared here anyway so the case
     * cannot be poisoned by neighbours, nor poison them.
     */
    public function test_delete_is_throttled_after_six_wrong_password_attempts(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        RateLimiter::clear(sha1((string) $user->id));

        for ($attempt = 1; $attempt <= 6; $attempt++) {
            $this->deleteJson(route('api.v1.profile.destroy'), ['password' => 'wrong-password'])
                ->assertUnprocessable();
        }

        $this->deleteJson(route('api.v1.profile.destroy'), ['password' => 'wrong-password'])
            ->assertStatus(429);

        $this->assertNotNull($user->fresh());
    }
}
