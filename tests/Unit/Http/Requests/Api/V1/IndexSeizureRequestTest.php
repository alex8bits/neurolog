<?php

namespace Tests\Unit\Http\Requests\Api\V1;

use App\Http\Requests\Api\V1\IndexSeizureRequest;
use Illuminate\Support\Facades\Validator as ValidatorFactory;
use Illuminate\Validation\Validator;
use Tests\TestCase;

class IndexSeizureRequestTest extends TestCase
{
    public function test_empty_query_passes(): void
    {
        $this->assertTrue($this->validate([])->passes());
    }

    public function test_well_formed_period_passes(): void
    {
        $validator = $this->validate([
            'from' => '2026-05-01',
            'to' => '2026-05-10',
            'timezone' => 'Europe/Moscow',
            'per_page' => 100,
        ]);

        $this->assertTrue($validator->passes());
    }

    public function test_localized_date_format_fails(): void
    {
        $validator = $this->validate(['from' => '10.05.2026']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('from'));
    }

    public function test_upper_bound_before_lower_bound_fails(): void
    {
        $validator = $this->validate(['from' => '2026-05-10', 'to' => '2026-05-09']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('to'));
    }

    public function test_equal_bounds_pass(): void
    {
        $this->assertTrue($this->validate(['from' => '2026-05-10', 'to' => '2026-05-10'])->passes());
    }

    public function test_invalid_timezone_fails(): void
    {
        $validator = $this->validate(['timezone' => 'Not/AZone']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('timezone'));
    }

    public function test_per_page_above_the_ceiling_fails(): void
    {
        $validator = $this->validate(['per_page' => 101]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('per_page'));
    }

    public function test_per_page_below_one_fails(): void
    {
        $validator = $this->validate(['per_page' => 0]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('per_page'));
    }

    public function test_non_numeric_per_page_fails(): void
    {
        $validator = $this->validate(['per_page' => 'abc']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('per_page'));
    }

    public function test_per_page_defaults_to_fifty(): void
    {
        $this->assertSame(50, $this->validatedRequest([])->perPage());
    }

    public function test_per_page_uses_the_requested_value(): void
    {
        $this->assertSame(25, $this->validatedRequest(['per_page' => '25'])->perPage());
    }

    public function test_accessors_treat_empty_strings_as_absent(): void
    {
        $request = $this->validatedRequest(['from' => '', 'to' => '', 'timezone' => '']);

        $this->assertNull($request->fromInput());
        $this->assertNull($request->toInput());
        $this->assertNull($request->timezoneInput());
    }

    public function test_accessors_return_the_submitted_values(): void
    {
        $request = $this->validatedRequest([
            'from' => '2026-05-01',
            'to' => '2026-05-10',
            'timezone' => 'Europe/Moscow',
        ]);

        $this->assertSame('2026-05-01', $request->fromInput());
        $this->assertSame('2026-05-10', $request->toInput());
        $this->assertSame('Europe/Moscow', $request->timezoneInput());
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function request(array $query): IndexSeizureRequest
    {
        $request = IndexSeizureRequest::create('/api/v1/seizures', 'GET', $query);
        $request->setContainer($this->app);

        return $request;
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function validate(array $query): Validator
    {
        /** @var Validator $validator */
        $validator = ValidatorFactory::make($query, $this->request($query)->rules());

        return $validator;
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function validatedRequest(array $query): IndexSeizureRequest
    {
        $request = $this->request($query);

        /** @var Validator $validator */
        $validator = ValidatorFactory::make($query, $request->rules());

        $this->assertTrue($validator->passes());

        $request->setValidator($validator);

        return $request;
    }
}
