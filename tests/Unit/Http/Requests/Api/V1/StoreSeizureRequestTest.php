<?php

namespace Tests\Unit\Http\Requests\Api\V1;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Tests\Concerns\BuildsStoreSeizureRequests;
use Tests\TestCase;

class StoreSeizureRequestTest extends TestCase
{
    use BuildsStoreSeizureRequests;

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

    public function test_naive_moment_of_right_now_paired_with_a_timezone_passes(): void
    {
        // 12:15 in Moscow is 09:15 UTC — five minutes in the past, not a future
        // moment. Judging the naive string in the app timezone would reject it.
        $validator = $this->storeSeizureValidator([
            'occurred_at' => '2026-05-10 12:15',
            'timezone' => 'Europe/Moscow',
        ]);

        $this->assertTrue($validator->passes(), 'A "just now" Moscow moment must pass validation.');
    }

    public function test_naive_moment_in_the_future_of_the_requested_timezone_fails(): void
    {
        // 14:15 in Moscow is 11:15 UTC — two hours ahead of the test clock.
        $validator = $this->storeSeizureValidator([
            'occurred_at' => '2026-05-10 14:15',
            'timezone' => 'Europe/Moscow',
        ]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('occurred_at'));
    }

    public function test_offset_aware_moment_in_the_future_fails(): void
    {
        $future = CarbonImmutable::now('UTC')->addHour()->setTimezone('Europe/Moscow')->toIso8601String();

        $validator = $this->storeSeizureValidator(['occurred_at' => $future]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('occurred_at'));
    }

    public function test_offset_aware_moment_in_the_past_passes(): void
    {
        $validator = $this->storeSeizureValidator(['occurred_at' => '2026-05-10T12:15:00+03:00']);

        $this->assertTrue($validator->passes());
    }

    public function test_naive_moment_without_timezone_is_judged_in_utc(): void
    {
        $validator = $this->storeSeizureValidator(['occurred_at' => '2026-05-10 12:15']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('occurred_at'));
    }

    public function test_small_clock_drift_is_tolerated(): void
    {
        $validator = $this->storeSeizureValidator([
            'occurred_at' => CarbonImmutable::now('UTC')->addMinutes(3)->toIso8601String(),
        ]);

        $this->assertTrue($validator->passes());
    }

    public function test_drift_beyond_the_tolerance_is_rejected(): void
    {
        $validator = $this->storeSeizureValidator([
            'occurred_at' => CarbonImmutable::now('UTC')->addMinutes(10)->toIso8601String(),
        ]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('occurred_at'));
    }

    public function test_unparseable_moment_fails_without_normalization_error(): void
    {
        $validator = $this->storeSeizureValidator(['occurred_at' => 'not-a-date']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('occurred_at'));
    }

    public function test_invalid_timezone_fails(): void
    {
        $validator = $this->storeSeizureValidator([
            'occurred_at' => '2026-05-10 08:15',
            'timezone' => 'Not/AZone',
        ]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('timezone'));
        $this->assertFalse($validator->errors()->has('occurred_at'));
    }

    public function test_comment_longer_than_the_limit_fails(): void
    {
        $validator = $this->storeSeizureValidator(['comment' => str_repeat('a', 2001)]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('comment'));
    }

    public function test_comment_at_the_limit_passes(): void
    {
        $validator = $this->storeSeizureValidator(['comment' => str_repeat('a', 2000)]);

        $this->assertTrue($validator->passes());
    }

    public function test_empty_payload_passes(): void
    {
        $this->assertTrue($this->storeSeizureValidator([])->passes());
    }

    public function test_accessors_treat_empty_strings_as_absent(): void
    {
        $request = $this->validatedStoreSeizureRequest([
            'occurred_at' => '',
            'comment' => '',
            'timezone' => '',
        ]);

        $this->assertNull($request->occurredAtInput());
        $this->assertNull($request->commentInput());
        $this->assertNull($request->timezoneInput());
    }

    public function test_accessors_return_the_submitted_values(): void
    {
        $request = $this->validatedStoreSeizureRequest([
            'occurred_at' => '2026-05-10 08:15',
            'comment' => 'Сильный приступ',
            'timezone' => 'Europe/Moscow',
        ]);

        $this->assertSame('2026-05-10 08:15', $request->occurredAtInput());
        $this->assertSame('Сильный приступ', $request->commentInput());
        $this->assertSame('Europe/Moscow', $request->timezoneInput());
    }
}
