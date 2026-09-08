<?php

namespace Tests\Unit\Http\Requests\Api\V1;

use App\Http\Requests\Api\V1\EmailDoctorRequest;
use Illuminate\Support\Facades\Validator as ValidatorFactory;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;
use Tests\TestCase;

class EmailDoctorRequestTest extends TestCase
{
    public function test_well_formed_payload_passes(): void
    {
        $validator = $this->validate([
            'to' => 'doctor@example.com',
            'subject' => 'Журнал приступов',
            'body' => 'Приступов за период не зафиксировано.',
        ]);

        $this->assertTrue($validator->passes());
    }

    public function test_payload_without_optional_fields_passes(): void
    {
        $validator = $this->validate(['to' => 'doctor@example.com']);

        $this->assertTrue($validator->passes());
    }

    public function test_missing_recipient_fails(): void
    {
        $validator = $this->validate(['subject' => 'Журнал приступов']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('to'));
    }

    public function test_recipient_that_is_not_an_email_fails(): void
    {
        $validator = $this->validate(['to' => 'not-an-email']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('to'));
    }

    public function test_recipient_above_the_length_ceiling_fails(): void
    {
        $validator = $this->validate(['to' => str_repeat('a', 250).'@example.com']);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('to'));
    }

    public function test_subject_above_the_length_ceiling_fails(): void
    {
        $validator = $this->validate([
            'to' => 'doctor@example.com',
            'subject' => str_repeat('a', 256),
        ]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('subject'));
    }

    public function test_body_above_the_length_ceiling_fails(): void
    {
        $validator = $this->validate([
            'to' => 'doctor@example.com',
            'body' => str_repeat('a', 5001),
        ]);

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('body'));
    }

    public function test_accessors_treat_empty_strings_as_absent(): void
    {
        $request = $this->validatedRequest([
            'to' => 'doctor@example.com',
            'subject' => '',
            'body' => '',
        ]);

        $this->assertSame('doctor@example.com', $request->toInput());
        $this->assertNull($request->subjectInput());
        $this->assertNull($request->bodyInput());
    }

    public function test_period_returns_the_submitted_values(): void
    {
        $request = $this->request(['to' => 'doctor@example.com']);
        $request->query->set('from', '2026-05-01');
        $request->query->set('to', '2026-05-10');
        $request->query->set('timezone', 'Europe/Moscow');

        $this->assertSame([
            'from' => '2026-05-01',
            'to' => '2026-05-10',
            'timezone' => 'Europe/Moscow',
        ], $request->validatedPeriod());
    }

    public function test_period_with_malformed_lower_bound_fails(): void
    {
        $request = $this->request(['to' => 'doctor@example.com']);
        $request->query->set('from', 'garbage');

        $this->assertPeriodFails($request, 'from');
    }

    public function test_period_with_upper_bound_before_lower_bound_fails(): void
    {
        $request = $this->request(['to' => 'doctor@example.com']);
        $request->query->set('from', '2026-05-10');
        $request->query->set('to', '2026-05-09');

        $this->assertPeriodFails($request, 'to');
    }

    public function test_period_with_invalid_timezone_fails(): void
    {
        $request = $this->request(['to' => 'doctor@example.com']);
        $request->query->set('timezone', 'Not/AZone');

        $this->assertPeriodFails($request, 'timezone');
    }

    public function test_period_with_blank_values_normalizes_to_null(): void
    {
        $request = $this->request(['to' => 'doctor@example.com']);
        $request->query->set('from', '');
        $request->query->set('to', '');
        $request->query->set('timezone', '');

        $this->assertSame([
            'from' => null,
            'to' => null,
            'timezone' => null,
        ], $request->validatedPeriod());
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function request(array $body): EmailDoctorRequest
    {
        $request = EmailDoctorRequest::create('/api/v1/seizures/email-doctor', 'POST', $body);
        $request->setContainer($this->app);

        return $request;
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function validate(array $body): Validator
    {
        /** @var Validator $validator */
        $validator = ValidatorFactory::make($body, $this->request($body)->rules());

        return $validator;
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function validatedRequest(array $body): EmailDoctorRequest
    {
        $request = $this->request($body);

        /** @var Validator $validator */
        $validator = ValidatorFactory::make($body, $request->rules());

        $this->assertTrue($validator->passes());

        $request->setValidator($validator);

        return $request;
    }

    private function assertPeriodFails(EmailDoctorRequest $request, string $key): void
    {
        try {
            $request->validatedPeriod();
            $this->fail('ValidationException was not thrown.');
        } catch (ValidationException $exception) {
            $this->assertTrue($exception->validator->errors()->has($key));
        }
    }
}
