<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeizureAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_access_seizure_endpoints(): void
    {
        $responses = [
            $this->postJson(route('api.v1.seizures.store')),
            $this->getJson(route('api.v1.seizures.index')),
            $this->getJson(route('api.v1.seizures.summary')),
            $this->deleteJson(route('api.v1.seizures.destroy', ['seizure' => 1])),
        ];

        foreach ($responses as $response) {
            $response->assertUnauthorized();
            $response->assertHeader('Content-Type', 'application/json');
        }
    }
}
