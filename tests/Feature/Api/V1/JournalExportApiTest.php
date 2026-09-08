<?php

namespace Tests\Feature\Api\V1;

use App\Mail\JournalReport;
use App\Models\Seizure;
use App\Models\User;
use App\Services\SeizureDocxBuilder;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Journal\ExportTest;
use Tests\TestCase;

/**
 * Feature tests for the mobile export/email endpoints of the journal.
 *
 * Conventions from CLAUDE.md: one happy-path per action + one auth test
 * for the whole group. The server chain is shared with the web actions
 * (see {@see ExportTest}); here we assert the API
 * semantics: Sanctum auth, JSON `{message}` payloads instead of Inertia
 * redirects, and the same shared per-user mail budget.
 */
class JournalExportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_download_docx_for_the_current_period(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        Seizure::factory()
            ->for($user)
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->withComment('Запись')
            ->create();

        $response = $this->actingAs($user)
            ->getJson(route('api.v1.seizures.export', ['from' => '2026-05-10', 'to' => '2026-05-10']));

        $response->assertOk();
        $response->assertHeader('Content-Type', SeizureDocxBuilder::DOCX_MIME);
        // Symfony encodes the cyrillic filename as RFC 5987 `filename*=` —
        // the percent-encoded form is always present, so we decode that one
        // and assert the underlying filename (mirror of the web test).
        $disposition = (string) $response->headers->get('Content-Disposition');
        $this->assertMatchesRegularExpression(
            "/filename\\*=utf-8''([^\"']+)/i",
            $disposition,
            'Content-Disposition должен содержать RFC 5987 filename* с UTF-8 именем.',
        );
        preg_match("/filename\\*=utf-8''([^\\s'\"]+)/i", $disposition, $matches);
        $this->assertSame(
            'Журнал_приступов_10.05.2026.docx',
            rawurldecode($matches[1]),
        );
        // DOCX is a zip: first two bytes are the 'PK' signature.
        $this->assertSame('PK', substr($response->streamedContent(), 0, 2));
    }

    public function test_user_can_email_themselves(): void
    {
        Mail::fake();
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        Seizure::factory()
            ->for($user)
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->create();

        $response = $this->actingAs($user)
            ->postJson(route('api.v1.seizures.email-self', ['from' => '2026-05-10', 'to' => '2026-05-10']));

        $response->assertOk();
        $response->assertJsonPath('message', "Отправлено на {$user->email}.");
        Mail::assertSent(JournalReport::class, function (JournalReport $mail) use ($user) {
            if (! $mail->hasTo($user->email)) {
                return false;
            }

            // attachments() возвращает массив Attachment-инстансов; в `as`
            // лежит исходное имя файла (см. JournalReport::attachments()).
            $attachments = $mail->attachments();
            $first = is_array($attachments) ? ($attachments[0] ?? null) : $attachments;

            return $first !== null
                && is_string($first->as)
                && str_ends_with($first->as, '.docx');
        });
    }

    public function test_user_can_email_a_doctor_with_custom_subject_and_body(): void
    {
        Mail::fake();
        $user = User::factory()->create();
        Seizure::factory()->for($user)->create();

        $response = $this->actingAs($user)
            ->postJson(route('api.v1.seizures.email-doctor', ['from' => '2026-05-10', 'to' => '2026-05-10']), [
                'to' => 'doctor@example.com',
                'subject' => 'Срочный вопрос',
                'body' => 'Здравствуйте, посмотрите пожалуйста.',
            ]);

        $response->assertOk();
        $response->assertJsonPath('message', 'Отправлено на doctor@example.com.');
        Mail::assertSent(JournalReport::class, function (JournalReport $mail) {
            return $mail->hasTo('doctor@example.com')
                && $mail->hasSubject('Срочный вопрос');
        });
    }

    public function test_guest_cannot_access_export_endpoints(): void
    {
        // API semantics: Sanctum rejects with 401 JSON, never a redirect.
        $this->getJson(route('api.v1.seizures.export'))->assertUnauthorized();
        $this->postJson(route('api.v1.seizures.email-self'))->assertUnauthorized();
        $this->postJson(route('api.v1.seizures.email-doctor'))->assertUnauthorized();
    }

    public function test_email_doctor_rejects_invalid_recipient_and_period(): void
    {
        Mail::fake();
        $user = User::factory()->create();
        Seizure::factory()->for($user)->create();

        // A malformed body recipient fails the standard Laravel 422 JSON
        // validation response.
        $this->actingAs($user)
            ->postJson(route('api.v1.seizures.email-doctor'), [
                'to' => 'not-an-email',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrorFor('to');

        // `?from=garbage` used to reach `CarbonImmutable::parse()` inside
        // `SeizureQuery::forPeriod()` and produce a 500 — the query bounds
        // are validated by `EmailDoctorRequest::validatedPeriod()`.
        $this->actingAs($user)
            ->postJson(route('api.v1.seizures.email-doctor', ['from' => 'garbage']), [
                'to' => 'doctor@example.com',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrorFor('from');

        Mail::assertNothingSent();
    }

    public function test_email_actions_are_rate_limited_per_user(): void
    {
        Mail::fake();
        $user = User::factory()->create();
        Seizure::factory()->for($user)->create();

        // Five sends fit the budget…
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($user)
                ->postJson(route('api.v1.seizures.email-self'))
                ->assertOk();
        }

        // …the sixth is rejected with 429…
        $this->actingAs($user)
            ->postJson(route('api.v1.seizures.email-self'))
            ->assertStatus(429);

        // …and the budget is shared with the doctor action (the throttle
        // keys by the authenticated user id alone, not by route).
        $this->actingAs($user)
            ->postJson(route('api.v1.seizures.email-doctor'), [
                'to' => 'doctor@example.com',
            ])
            ->assertStatus(429);

        Mail::assertSent(JournalReport::class, 5);
    }
}
