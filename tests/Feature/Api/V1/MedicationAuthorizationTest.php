<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MedicationAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_access_medication_endpoints(): void
    {
        $responses = [
            $this->getJson(route('api.v1.medications.index')),
            $this->postJson(route('api.v1.medications.store')),
            $this->patchJson(route('api.v1.medications.update', ['medication' => 1])),
            $this->deleteJson(route('api.v1.medications.destroy', ['medication' => 1])),
        ];

        foreach ($responses as $response) {
            $response->assertUnauthorized();
            $response->assertHeader('Content-Type', 'application/json');
        }
    }
}
