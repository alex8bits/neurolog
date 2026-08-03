<?php

namespace Tests\Unit\Services;

use App\Models\User;
use App\Services\SeizureWriter;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\BuildsStoreSeizureRequests;
use Tests\TestCase;

/**
 * Pins the seam between validation and the write path.
 *
 * `StoreSeizureRequest` judges "is this moment in the future?" and
 * `SeizureWriter` decides which instant actually lands in the database. If the
 * two ever interpret the same payload differently, a rejected payload could be
 * storable (or an accepted one could store a future moment) — that divergence
 * was the blocker of the previous review, so it gets its own test.
 */
class SeizureValidationWriteSeamTest extends TestCase
{
    use BuildsStoreSeizureRequests;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Date::setTestNow(CarbonImmutable::parse('2026-05-10 09:20:00', 'UTC'));
    }

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    /**
     * The payload shapes where the two paths could actually drift apart.
     *
     * Offset-aware and zulu inputs carry their own offset, so no resolver is
     * involved and {@see SeizureWriterTest} already pins them — repeating them
     * here would only duplicate coverage. What is left are the shapes whose
     * meaning depends on the timezone resolver and on the drift tolerance.
     *
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function acceptedPayloads(): array
    {
        return [
            'naive moment with an explicit timezone' => [
                ['occurred_at' => '2026-05-10 12:15:00', 'timezone' => 'Europe/Moscow'],
                '2026-05-10 09:15:00',
            ],
            'moment inside the clock drift tolerance' => [
                ['occurred_at' => '2026-05-10 12:23:00', 'timezone' => 'Europe/Moscow'],
                '2026-05-10 09:23:00',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('acceptedPayloads')]
    public function test_a_validated_payload_is_written_as_the_very_instant_validation_judged(
        array $payload,
        string $expectedUtc,
    ): void {
        $request = $this->validatedStoreSeizureRequest($payload);

        $seizure = app(SeizureWriter::class)->record(
            User::factory()->create(),
            $request->occurredAtInput(),
            $request->commentInput(),
            $request->timezoneInput(),
        );

        $this->assertSame(
            $expectedUtc,
            $seizure->occurred_at->setTimezone('UTC')->format('Y-m-d H:i:s'),
        );

        // The invariant the rule exists for: whatever validation accepted must
        // not land in the database as a future moment.
        $this->assertTrue(
            $seizure->occurred_at->lessThanOrEqualTo(CarbonImmutable::now('UTC')->addMinutes(5)),
            'A payload accepted by validation must never be written as a future moment.',
        );
    }

    public function test_a_payload_rejected_as_future_would_indeed_be_written_as_a_future_moment(): void
    {
        $payload = ['occurred_at' => '2026-05-10 14:15:00', 'timezone' => 'Europe/Moscow'];

        $validator = $this->storeSeizureValidator($payload);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('occurred_at'));

        // Had the rule not fired, the writer would have stored 11:15 UTC — well
        // beyond the tolerated drift. The two paths agree on the instant.
        $seizure = app(SeizureWriter::class)->record(
            User::factory()->create(),
            '2026-05-10 14:15:00',
            null,
            'Europe/Moscow',
        );

        $this->assertSame(
            '2026-05-10 11:15:00',
            $seizure->occurred_at->setTimezone('UTC')->format('Y-m-d H:i:s'),
        );
        $this->assertTrue(
            $seizure->occurred_at->greaterThan(CarbonImmutable::now('UTC')->addMinutes(5)),
        );
    }
}
