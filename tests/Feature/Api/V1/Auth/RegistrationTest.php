<?php

namespace Tests\Feature\Api\V1\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_defaults_to_utc_when_timezone_is_absent(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'timezone' => 'UTC',
        ]);
    }

    public function test_register_persists_a_valid_timezone_from_the_payload(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'timezone' => 'Asia/Novosibirsk',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'timezone' => 'Asia/Novosibirsk',
        ]);
    }

    public function test_register_rejects_an_invalid_timezone_with_422(): void
    {
        $response = $this->postJson('/api/v1/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'timezone' => 'Not/AZone',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['timezone']);
        $this->assertDatabaseMissing('users', ['email' => 'test@example.com']);
    }
}
